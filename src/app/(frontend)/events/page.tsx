/**
 * Events Page
 * Server component wrapper for events page with metadata
 */

import { Metadata } from 'next';
import { EventsPageContent } from '@/components/events/events-page-content';

// ISR: Revalidate every 5 minutes as fallback (on-demand revalidation handles immediate updates)
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Events | Lolev Beer',
  description: 'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience at our Lawrenceville and Zelienople locations.',
  keywords: ['brewery events', 'trivia night', 'live music', 'Pittsburgh brewery', 'beer events'],
  openGraph: {
    title: 'Events | Lolev Beer',
    description: 'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience.',
    type: 'website',
  }
};


export default function EventsPage() {
  return <EventsPageContent />;
}