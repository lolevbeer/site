'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Check if we're on an admin route or menu display route
  const isAdminRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/api');
  const isMenuRoute = pathname?.startsWith('/m/');

  // Don't render layout for admin/api routes or menu display routes
  if (isAdminRoute || isMenuRoute) {
    return <main id="main-content" className="h-screen">{children}</main>;
  }

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
