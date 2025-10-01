'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Lazy load the map component
const DistributorMap = dynamic(
  () => import('@/components/ui/distributor-map').then(mod => mod.DistributorMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }
);

export function BeerMapContent() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Where to Find Love of Lev</h1>
        <p className="text-lg text-muted-foreground">
          Find our beers at hundreds of locations across Pennsylvania and New York.
          Use the map below to discover bars, restaurants, and retailers near you.
        </p>
      </div>

      {/* Distributor Map */}
      <div style={{ height: '600px', position: 'relative' }}>
        <DistributorMap
          height={600}
          showSearch={true}
          showFilters={true}
          initialZoom={6.5}
          maxPoints={1000}
        />
      </div>
    </div>
  );
}