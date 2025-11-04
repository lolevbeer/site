'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MapLoadingSkeleton } from '@/lib/utils/lazy-load';
import { HoursPanel } from '@/components/location/hours-panel';

// Lazy load the map component - no SSR for better performance
const DistributorMap = dynamic(
  () => import('@/components/ui/distributor-map').then(mod => mod.DistributorMap),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />
  }
);

export function BeerMapContent() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold">
          Where to find us
        </h1>
      </div>

      {/* Distributor Map */}
      <div className="rounded-xl overflow-hidden border" style={{ height: '700px', position: 'relative' }}>
        <DistributorMap
          height={700}
          showSearch={true}
          initialZoom={6.5}
          maxPoints={10}
        />
      </div>

      {/* Hours Panel */}
      <div className="mt-8">
        <HoursPanel />
      </div>
    </div>
  );
}