import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          title="Notifications"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 md:w-96 p-0 shadow-xl border-border/80"
      >
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
            {unreadCount > 0 ? (
              <Badge variant="default" className="text-[10px] h-5 px-1.5 font-bold">
                {unreadCount} new
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                All read
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-3.5 hover:bg-accent/40 transition-colors text-left flex gap-3 cursor-pointer ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    <span
                      className={`h-2 w-2 rounded-full block ${
                        !n.read ? 'bg-primary ring-2 ring-primary/20' : 'bg-muted-foreground/30'
                      }`}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {n.description}
                    </p>
                    {n.link && (
                      <div className="pt-1">
                        <Link
                          to={n.link}
                          className="inline-flex items-center text-[11px] font-semibold text-primary hover:underline gap-1"
                        >
                          View Details <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
