/** 404 for /events/<id>: the event is unknown, private, past, or the id is malformed. */
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-3xl font-bold mb-4">Event Not Found</h2>
      <p className="text-muted-foreground mb-8">This event isn&apos;t on the calendar.</p>
      <Button asChild variant="outline">
        <Link href="/events">View All Events</Link>
      </Button>
    </div>
  )
}
