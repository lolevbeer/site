import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationCardProps {
  name: string;
  address: string;
  distance?: number;
  isSelected: boolean;
  onClick: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
}

const capitalizeName = (name: string) => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function LocationCard({
  name,
  address,
  distance,
  isSelected,
  onClick,
  innerRef
}: LocationCardProps) {
  return (
    <Card
      ref={innerRef}
      className={cn(
        "p-3 cursor-pointer transition-all border-0 shadow-none bg-[var(--color-card-interactive)]",
        isSelected ? "bg-primary/5" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">
            {capitalizeName(name)}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 uppercase">
            {address}
          </p>
          {distance !== undefined && (
            <span className="text-xs font-medium text-primary mt-1 inline-block">
              {distance.toFixed(1)} mi away
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0 hover:bg-primary hover:text-primary-foreground cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            window.open(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
              '_blank'
            );
          }}
        >
          <Navigation className="h-3 w-3 mr-1" />
          Directions
        </Button>
      </div>
    </Card>
  );
}
