'use client';

/**
 * Inline newsletter signup form
 * Submits email to /api/newsletter which creates a Square customer record.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface NewsletterFormProps {
  className?: string;
  /** Heading text above the form */
  heading?: string;
  /** Compact mode for card placement */
  compact?: boolean;
}

export function NewsletterForm({ className, heading = 'Stay in the loop', compact = false }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className={cn('text-center', className)}>
        {heading && <p className={cn('font-semibold mb-2', compact ? 'text-sm' : 'text-base')}>{heading}</p>}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span>Thanks! You&apos;re on the list.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('text-center', className)}>
      {heading && <p className={cn('font-semibold mb-3', compact ? 'text-sm' : 'text-base')}>{heading}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          disabled={status === 'loading'}
          className={cn('flex-1', compact && 'h-9 text-sm')}
          aria-label="Email address"
        />
        <Button
          type="submit"
          variant="default"
          size={compact ? 'sm' : 'default'}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? '...' : 'Subscribe'}
        </Button>
      </form>
      {status === 'error' && errorMessage && (
        <p className="text-sm text-destructive mt-2">{errorMessage}</p>
      )}
    </div>
  );
}
