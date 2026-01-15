/**
 * SpeakableSpecification schema for voice search optimization
 * Tells search engines which content is suitable for text-to-speech
 * @see https://schema.org/SpeakableSpecification
 * @see https://developers.google.com/search/docs/appearance/structured-data/speakable
 */

export interface SpeakableJsonLd {
  '@context': 'https://schema.org';
  '@type': 'WebPage';
  name: string;
  url: string;
  speakable: {
    '@type': 'SpeakableSpecification';
    cssSelector?: string[];
    xpath?: string[];
  };
}

/**
 * Generate Speakable schema for a page
 * @param name - Page title
 * @param url - Page URL
 * @param cssSelectors - CSS selectors for speakable content
 */
export function generateSpeakableSchema(
  name: string,
  url: string,
  cssSelectors: string[]
): SpeakableJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: cssSelectors,
    },
  };
}

/**
 * Pre-configured speakable schemas for common pages
 */
export const speakableConfigs = {
  home: {
    name: 'Lolev Beer - Craft Brewery in Pittsburgh',
    selectors: [
      '[data-speakable="hours"]',
      '[data-speakable="location"]',
      '[data-speakable="description"]',
    ],
  },
  faq: {
    name: 'FAQ - Lolev Beer',
    selectors: [
      '[data-speakable="faq-answer"]',
      '.accordion-content',
    ],
  },
  about: {
    name: 'About Lolev Beer',
    selectors: [
      '[data-speakable="philosophy"]',
      '[data-speakable="locations"]',
    ],
  },
  beer: {
    name: 'Our Beers - Lolev Beer',
    selectors: [
      '[data-speakable="beer-description"]',
    ],
  },
};

/**
 * Generate speakable schema for homepage
 */
export function generateHomeSpeakableSchema(): SpeakableJsonLd {
  const baseUrl = 'https://lolev.beer';
  return generateSpeakableSchema(
    speakableConfigs.home.name,
    baseUrl,
    speakableConfigs.home.selectors
  );
}

/**
 * Generate speakable schema for FAQ page
 */
export function generateFAQSpeakableSchema(): SpeakableJsonLd {
  const baseUrl = 'https://lolev.beer';
  return generateSpeakableSchema(
    speakableConfigs.faq.name,
    `${baseUrl}/faq`,
    speakableConfigs.faq.selectors
  );
}

/**
 * Generate speakable schema for About page
 */
export function generateAboutSpeakableSchema(): SpeakableJsonLd {
  const baseUrl = 'https://lolev.beer';
  return generateSpeakableSchema(
    speakableConfigs.about.name,
    `${baseUrl}/about`,
    speakableConfigs.about.selectors
  );
}

/**
 * Generate speakable schema for individual beer page
 */
export function generateBeerSpeakableSchema(beerName: string, beerSlug: string): SpeakableJsonLd {
  const baseUrl = 'https://lolev.beer';
  return generateSpeakableSchema(
    `${beerName} - Lolev Beer`,
    `${baseUrl}/beer/${beerSlug}`,
    speakableConfigs.beer.selectors
  );
}
