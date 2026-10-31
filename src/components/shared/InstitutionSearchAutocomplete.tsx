/**
 * src/components/shared/InstitutionSearchAutocomplete.tsx
 * EquipSync – Live search suggestion input for organizations/institutions.
 * Includes 250ms debounce, keyboard navigation, and selection validation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Building, Check, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchInstitutions, Institution } from '@/lib/auth';
import { cn } from '@/lib/utils';

export interface InstitutionSearchAutocompleteProps {
  onSelect: (inst: Institution | null) => void;
  selectedInstitution: Institution | null;
  error?: string | null;
  className?: string;
}

export function InstitutionSearchAutocomplete({
  onSelect,
  selectedInstitution,
  error,
  className,
}: InstitutionSearchAutocompleteProps) {
  const [query, setQuery] = useState(selectedInstitution?.name || '');
  const [suggestions, setSuggestions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasInteracted, setHasInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (selectedInstitution) {
      setQuery(selectedInstitution.name);
    }
  }, [selectedInstitution]);

  // Debounced search after 3 characters
  useEffect(() => {
    clearTimeout(debounceTimerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    // If query matches currently selected, no need to re-query
    if (selectedInstitution && selectedInstitution.name === trimmed) {
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const results = await searchInstitutions(trimmed);
        setSuggestions(results);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch {
        // Handle query_too_short or network blips quietly
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, [query, selectedInstitution]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (inst: Institution) => {
    setQuery(inst.name);
    onSelect(inst);
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHasInteracted(true);
    // If user edits text after selecting, clear the selection until chosen again
    if (selectedInstitution && val !== selectedInstitution.name) {
      onSelect(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isSelected = !!selectedInstitution;
  const isInvalid = !isSelected && hasInteracted && query.trim().length > 0;

  return (
    <div ref={containerRef} className={cn('relative w-full space-y-1', className)}>
      <div className="relative">
        <Input
          type="text"
          role="combobox"
          aria-controls="institution-search-listbox"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Organization Name Search"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-invalid={!!error || isInvalid}
          className={cn(
            'pr-9 transition-colors text-xs h-9 hover:border-primary/40 focus-visible:ring-1',
            (error || isInvalid) && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <div className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isSelected ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground/60" />
          )}
        </div>
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-muted-foreground leading-tight">
        Choose your organization from the list. Can't find it? Ask your admin to register it first.
      </p>

      {/* Inline Selection Validation Error */}
      {(error || (isInvalid && !isOpen)) && (
        <div className="flex items-center gap-1 text-[11px] text-destructive font-medium pt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error || 'Please select an organization from the suggestions list.'}</span>
        </div>
      )}

      {/* Suggestion Dropdown Listbox */}
      {isOpen && (
        <div
          id="institution-search-listbox"
          role="listbox"
        >
          {suggestions.length === 0 && query.trim().length >= 3 && !isLoading ? (
            <div className="p-3 text-center text-muted-foreground text-[11px]">
              No organization found matching "{query}"
            </div>
          ) : (
            suggestions.map((inst, index) => {
              const isItemActive = index === activeIndex;
              const isItemChosen = selectedInstitution?.id === inst.id;

              return (
                <div
                  key={inst.id}
                  role="option"
                  aria-selected={isItemChosen}
                  onClick={() => handleSelect(inst)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors',
                    isItemActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60',
                    isItemChosen && 'bg-primary/5 text-primary'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Building className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate font-semibold text-foreground">{inst.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase shrink-0">
                    {inst.type}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
