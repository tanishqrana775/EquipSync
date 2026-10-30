import { Resource } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { MapPin, Building, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceThumbProps {
  resource: Resource;
  onClick?: () => void;
  className?: string;
}

export function ResourceThumb({
  resource,
  onClick,
  className,
}: ResourceThumbProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group surface surface-hover overflow-hidden rounded-2xl flex flex-col transition-all cursor-pointer border border-border/80',
        className
      )}
    >
      {/* Image Thumbnail Header */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={resource.imageUrl}
          alt={resource.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3">
          <StatusBadge status={resource.status} />
        </div>

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs">
          <span className="font-semibold text-[11px] px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md">
            {resource.category}
          </span>
          <span className="text-[11px] font-medium bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full">
            {resource.availableQuantity} of {resource.totalQuantity} avail
          </span>
        </div>
      </div>

      {/* Resource Details */}
      <div className="p-4 flex flex-1 flex-col justify-between space-y-3">
        <div>
          <h4 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {resource.title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {resource.description}
          </p>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate max-w-[65%]">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{resource.location}</span>
          </div>

          <div className="flex items-center gap-1 font-semibold text-foreground">
            <span className="text-primary font-bold">{resource.utilisationRate}%</span>
            <span className="text-[10px] text-muted-foreground font-normal">used</span>
          </div>
        </div>
      </div>
    </div>
  );
}
