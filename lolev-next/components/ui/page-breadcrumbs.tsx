'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

const pathLabels: Record<string, string> = {
  'beer': 'Beer',
  'beer-map': 'Find Us',
  'events': 'Events',
  'food': 'Food',
  'about': 'About',
  'privacy': 'Privacy Policy',
  'terms': 'Terms of Service',
};

function generateBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  // Remove trailing slash and split
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: 'Home', href: '/' }
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Use custom label if available, otherwise format the segment
    const label = pathLabels[segment] ||
                  segment.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ');

    breadcrumbs.push({
      label,
      href: currentPath
    });
  });

  return breadcrumbs;
}

interface PageBreadcrumbsProps {
  customSegments?: BreadcrumbSegment[];
  className?: string;
}

export function PageBreadcrumbs({ customSegments, className }: PageBreadcrumbsProps) {
  const pathname = usePathname();

  // Don't show breadcrumbs on home page
  if (pathname === '/') {
    return null;
  }

  const breadcrumbs = customSegments || generateBreadcrumbs(pathname);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div key={crumb.href} className="contents">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
