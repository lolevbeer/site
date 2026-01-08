'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MapLoadingSkeleton } from '@/lib/utils/lazy-load';
import { HoursPanel } from '@/components/location/hours-panel';
import type { WeeklyHoursDay, DistributorGeoJSON } from '@/lib/utils/payload-api';

// Lazy load the map component - no SSR for better performance
const DistributorMap = dynamic(
  () => import('@/components/ui/distributor-map').then(mod => mod.DistributorMap),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />
  }
);

interface BeerMapContentProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
  distributorData?: DistributorGeoJSON;
}

export function BeerMapContent({ weeklyHours, distributorData }: BeerMapContentProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          Where to find us
        </h1>
        <div className="w-16 h-1 bg-primary mx-auto rounded-full" />
      </div>

      {/* Hours Panel */}
      <div className="mb-8 max-w-md mx-auto">
        <HoursPanel weeklyHours={weeklyHours} />
      </div>

      {/* Distributor Map */}
      <div className="overflow-hidden" style={{ height: '700px', position: 'relative' }}>
        <DistributorMap
          height={700}
          showSearch={true}
          initialZoom={5}
          maxPoints={10}
          initialData={distributorData}
        />
      </div>
    </div>
  );
}