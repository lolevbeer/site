'use client';

/**
 * Hidden staff tool: shows copy-ready marketing text when the homepage URL
 * hash is `#marketing`. The text is built on the server by
 * lib/utils/marketing-copy.ts, so the homepage ships a few KB of strings for
 * this instead of full menus and schedules.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MarketingCopy, MarketingSection } from '@/lib/utils/marketing-copy';

function Sections({ sections }: { sections: MarketingSection[] }) {
  return sections.map((section, index) => (
    <React.Fragment key={`${index}-${section.heading}`}>
      {index > 0 && <div className="my-6" />}
      <div>
        <div className="mb-2">{section.heading}</div>
        {section.lines.map((line, lineIndex) => (
          <div key={lineIndex}>{line}</div>
        ))}
      </div>
    </React.Fragment>
  ));
}

function copySectionToClipboard(sectionId: string) {
  const textElement = document.getElementById(sectionId);
  if (textElement) {
    navigator.clipboard.writeText(textElement.innerText);
  }
}

const SECTIONS: { id: string; label: string; key: keyof MarketingCopy }[] = [
  { id: 'draft-section', label: 'Copy Draft', key: 'draft' },
  { id: 'cans-section', label: 'Copy Cans', key: 'cans' },
  { id: 'upcoming-section', label: 'Copy Upcoming', key: 'upcoming' },
];

export function MarketingText({ copy }: { copy: MarketingCopy }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkHash = () => {
      setIsVisible(window.location.hash === '#marketing');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Marketing Copy</h1>
        </div>

        <div id="marketing-text-content" className="space-y-8 font-mono text-sm whitespace-pre-wrap">
          {SECTIONS.map(({ id, label, key }, index) => (
            <React.Fragment key={id}>
              {index > 0 && <div className="border-t-2 border-foreground my-4"></div>}
              <div className="relative">
                <Button
                  onClick={() => copySectionToClipboard(id)}
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0"
                >
                  {label}
                </Button>
                <div id={id}>
                  <Sections sections={copy[key]} />
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
