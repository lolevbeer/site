'use client';

import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';

interface AdminEditButtonProps {
  beerId: string;
}

export function AdminEditButton({ beerId }: AdminEditButtonProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Don't render while loading or if not authenticated
  if (isLoading || !isAuthenticated) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="shrink-0"
    >
      <a
        href={`/admin/collections/beers/${beerId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </a>
    </Button>
  );
}
