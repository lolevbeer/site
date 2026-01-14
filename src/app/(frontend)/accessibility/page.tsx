import { Metadata } from 'next';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { generateBreadcrumbSchema, generateWebPageSchema } from '@/lib/utils/breadcrumb-schema';

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description: 'Lolev Beer website conforms to WCAG 2.2 Level AA standards for web accessibility.',
  openGraph: {
    title: 'Accessibility Statement | Lolev Beer',
    description: 'WCAG 2.2 Level AA compliant website.',
    type: 'website',
  }
};

export default function AccessibilityPage() {
  const lastUpdated = 'October 12, 2025';

  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'Accessibility', href: '/accessibility' }
  ]);
  const webPageSchema = generateWebPageSchema({
    name: 'Accessibility Statement',
    description: 'Lolev Beer website conforms to WCAG 2.2 Level AA standards for web accessibility.',
    path: '/accessibility',
    dateModified: '2025-10-12'
  });

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={webPageSchema} />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <PageBreadcrumbs className="mb-6" />

      <h1 className="text-4xl font-bold tracking-tight mb-8">Accessibility Statement</h1>

      <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Conformance Status</h2>
          <p className="mb-4">
            This website conforms to <strong>WCAG 2.2 Level AA</strong> (Web Content Accessibility Guidelines 2.2).
          </p>
          <p>
            All 87 applicable success criteria have been met, ensuring compliance with:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Americans with Disabilities Act (ADA) Title III</li>
            <li>Section 508 of the Rehabilitation Act</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Accessibility Features</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Full keyboard navigation support</li>
            <li>Screen reader compatibility (NVDA, JAWS, VoiceOver, TalkBack)</li>
            <li>Minimum 4.5:1 color contrast ratios</li>
            <li>Responsive design (320px to 4K viewports)</li>
            <li>Text resizable up to 200% without loss of content</li>
            <li>Touch targets minimum 24×24 pixels</li>
            <li>Semantic HTML and proper ARIA labels</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Reporting Issues</h2>
          <p className="mb-4">
            If you encounter any accessibility barriers, please contact us:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Email: <a href="mailto:info@lolev.beer" className="text-primary hover:underline">info@lolev.beer</a> (include "Accessibility" in subject)
            </li>
            <li>
              Phone: <a href="tel:4123368965" className="text-primary hover:underline">(412) 336-8965</a>
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            We aim to respond within 2 business days.
          </p>
        </section>

        <section className="pt-8 border-t text-sm text-muted-foreground">
          <p><strong>Last updated:</strong> {lastUpdated}</p>
        </section>
        </div>
      </div>
    </>
  );
}
