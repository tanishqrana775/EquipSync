/**
 * src/lib/realtimeStatus.ts
 * EquipSync – Centralized Realtime Status Store using useSyncExternalStore.
 * Single dedicated channel started when authenticated and stopped on sign-out.
 * Reports 'connected' or 'reconnecting' with a 3-second debounce on disconnections
 * and listens to browser online/offline events.
 */

import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type RealtimeConnectionStatus = 'connected' | 'reconnecting';

type Listener = () => void;

let currentStatus: RealtimeConnectionStatus = 'connected';
let activeChannel: RealtimeChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function setStatus(next: RealtimeConnectionStatus) {
  if (currentStatus === next) return;
  currentStatus = next;
  notify();
}

function handleOnline() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  setStatus('connected');
}

function handleOffline() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  setStatus('reconnecting');
}

/**
 * Triggered on websocket channel events.
 * Debounces the 'reconnecting' state transition by 3 seconds so transient blips
 * do not flicker the UI.
 */
function handleChannelStatus(status: string) {
  if (status === 'SUBSCRIBED') {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    setStatus('connected');
  } else if (
    status === 'CLOSED' ||
    status === 'CHANNEL_ERROR' ||
    status === 'TIMED_OUT' ||
    status === 'DISCONNECTED'
  ) {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        setStatus('reconnecting');
      }, 3000);
    }
  }
}

// Attach browser online/offline listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

/**
 * Start the singleton Supabase Realtime channel probe for the session.
 */
export function startRealtimeStatusStore() {
  if (activeChannel) return;

  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    setStatus('reconnecting');
  } else {
    setStatus('connected');
  }

  activeChannel = supabase.channel('equipsync_realtime_presence_probe');
  activeChannel.subscribe((status) => {
    handleChannelStatus(status);
  });
}

/**
 * Stop and unsubscribe the singleton channel when the user signs out.
 */
export function stopRealtimeStatusStore() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
  setStatus('connected');
}

export function subscribeRealtimeStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRealtimeStatus(): RealtimeConnectionStatus {
  return currentStatus;
}

/**
 * useRealtimeStatus() hook using useSyncExternalStore.
 * Returns true if connected, false if reconnecting.
 */
export function useRealtimeStatus(): boolean {
  const status = useSyncExternalStore(
    subscribeRealtimeStatus,
    getRealtimeStatus,
    () => 'connected'
  );
  return status === 'connected';
}
