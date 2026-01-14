'use client';

import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';

interface SectionHeaderProps {
  /** The section title */
  title: string;
  /** URL for the admin edit button */
  adminUrl?: string;
  /** Custom edit button label (defaults to "Edit") */
  editLabel?: string;
}

/**
 * Reusable section header with centered title and optional admin edit button
 * Auth is checked client-side to keep pages static/cached
 */
export function SectionHeader({
  title,
  adminUrl,
  editLabel = 'Edit',
}: SectionHeaderProps) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1" />
        <h2 className="text-3xl lg:text-4xl font-bold">{title}</h2>
        <div className="flex-1 flex justify-end">
          {isAuthenticated && adminUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                <Pencil className="h-4 w-4 mr-1" />
                {editLabel}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
