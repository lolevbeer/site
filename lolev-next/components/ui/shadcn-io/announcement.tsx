import * as React from 'react';
import { cn } from '@/lib/utils';

const Announcement = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      className
    )}
    {...props}
  />
));
Announcement.displayName = 'Announcement';

const AnnouncementTag = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "mr-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground",
      className
    )}
    {...props}
  />
));
AnnouncementTag.displayName = 'AnnouncementTag';

const AnnouncementTitle = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("text-sm", className)}
    {...props}
  />
));
AnnouncementTitle.displayName = 'AnnouncementTitle';

export { Announcement, AnnouncementTag, AnnouncementTitle };