/**
 * BreadcrumbList and WebPage schema generation
 * Helps with navigation display in search results
 * @see https://schema.org/BreadcrumbList
 * @see https://schema.org/WebPage
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

/**
 * Schema.org WebPage type
 */
export interface WebPageJsonLd {
  '@context': 'https://schema.org';
  '@type': 'WebPage';
  '@id': string;
  name: string;
  description?: string;
  url: string;
  isPartOf?: { '@id': string };
  about?: { '@id': string };
  dateModified?: string;
  inLanguage?: string;
}

export interface WebPageOptions {
  name: string;
  description?: string;
  path: string;
  dateModified?: string;
}

/**
 * Generate WebPage JSON-LD schema
 */
export function generateWebPageSchema(
  options: WebPageOptions,
  baseUrl: string = 'https://lolev.beer'
): WebPageJsonLd {
  const url = `${baseUrl}${options.path}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: options.name,
    description: options.description,
    url,
    isPartOf: { '@id': `${baseUrl}#website` },
    about: { '@id': `${baseUrl}#organization` },
    dateModified: options.dateModified,
    inLanguage: 'en-US'
  };
}
