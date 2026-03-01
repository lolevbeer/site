/**
 * Lightweight markdown renderer for CMS textarea content.
 * Wraps react-markdown with prose styling.
 */

import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          // Open external links in new tab
          a: ({ href, children: linkChildren, ...props }) => (
            <a
              href={href}
              {...(href?.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              {...props}
            >
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
