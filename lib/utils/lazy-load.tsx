import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Create a lazily loaded component with better type safety
 * @param importFn - Function that imports the component
 * @param options - Dynamic import options
 */
export function createLazyComponent<T extends React.ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<{ default: T } | T>,
  options?: {
    ssr?: boolean;
    loading?: () => React.ReactNode;
  }
) {
  return dynamic(
    () => importFn().then(mod => ('default' in mod ? mod : { default: mod as T })),
    {
      ssr: options?.ssr ?? true,
      loading: options?.loading,
    }
  );
}

/**
 * Common loading skeleton for lazy loaded components
 */
export function LoadingSkeleton({ height = '400px' }: { height?: string }) {
  return (
    <div
      className="animate-pulse bg-muted rounded-lg"
      style={{ height }}
      aria-label="Loading..."
    />
  );
}

/**
 * Map loading skeleton
 */
export function MapLoadingSkeleton() {
  return (
    <div className="relative w-full h-[600px] bg-muted rounded-lg animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading map...</p>
        </div>
      </div>
    </div>
  );
}
