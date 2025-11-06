'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const [hideLayout, setHideLayout] = useState(false);

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      setHideLayout(hash === '#draft' || hash === '#cans');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  if (hideLayout) {
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
