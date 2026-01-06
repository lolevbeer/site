'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface AdminEditButtonProps {
  beerId: string;
}

export function AdminEditButton({ beerId }: AdminEditButtonProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user has payload-token cookie (simple client-side check)
    const hasToken = document.cookie.includes('payload-token');
    setIsAdmin(hasToken);
  }, []);

  if (!isAdmin) return null;

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
