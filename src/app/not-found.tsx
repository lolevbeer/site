import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** Root 404 so unmatched URLs (outside the frontend group) still recover to / and /beer. */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p>
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/">Go Home</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/beer">View Beer Menu</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
