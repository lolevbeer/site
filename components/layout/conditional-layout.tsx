'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import type { WeeklyHoursDay } from '@/lib/utils/payload-api';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
}

export function ConditionalLayout({ children, weeklyHours }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Check if we're on an admin route or menu display route
  const isAdminRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/api');
  const isMenuRoute = pathname?.startsWith('/m/');

  // Don't render layout for admin/api routes or menu display routes
  if (isAdminRoute || isMenuRoute) {
    return <main id="main-content" tabIndex={-1} className="h-screen outline-none">{children}</main>;
  }

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer weeklyHours={weeklyHours} />
    </>
  );
}
