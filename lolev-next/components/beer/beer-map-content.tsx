'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

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
    </div>
  );
}