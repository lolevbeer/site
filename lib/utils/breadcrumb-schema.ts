/**
 * BreadcrumbList schema generation
 * Helps with navigation display in search results
 * @see https://schema.org/BreadcrumbList
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */

export interface BreadcrumbItem {
  label: string;
  href: string;
}

/**
 * Schema.org BreadcrumbList type
 */
export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbListItemJsonLd[];
}

export interface BreadcrumbListItemJsonLd {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

/**
 * Generate BreadcrumbList JSON-LD schema
 */
export function generateBreadcrumbSchema(
  breadcrumbs: BreadcrumbItem[],
  baseUrl: string = 'https://lolev.beer'
): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => {
      const item: BreadcrumbListItemJsonLd = {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label
      };

      // Don't add 'item' property to the last breadcrumb (current page)
      if (index < breadcrumbs.length - 1) {
        item.item = `${baseUrl}${crumb.href}`;
      }

      return item;
    })
  };
}
