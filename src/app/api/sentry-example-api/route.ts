import { NextResponse } from 'next/server';

export function GET() {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  throw new Error('Sentry Example API Route Error');
  return NextResponse.json({ ok: true });
}
