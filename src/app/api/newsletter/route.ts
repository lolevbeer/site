/**
 * Newsletter signup API route
 * Accepts an email address and creates/finds a Square customer record.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

const SQUARE_BASE_URL =
  process.env.SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

interface SquareCustomer {
  id: string;
  email_address?: string;
}

interface SquareSearchResponse {
  customers?: SquareCustomer[];
}

interface SquareCreateResponse {
  customer?: SquareCustomer;
  errors?: { code: string; detail: string }[];
}

async function squareFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SQUARE_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Square-Version': '2024-11-20',
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square API ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!process.env.SQUARE_ACCESS_TOKEN) {
      logger.error('SQUARE_ACCESS_TOKEN is not configured');
      return NextResponse.json({ error: 'Newsletter signup is temporarily unavailable' }, { status: 503 });
    }

    // Check if customer already exists
    const searchResult = await squareFetch<SquareSearchResponse>('/v2/customers/search', {
      query: {
        filter: {
          email_address: {
            exact: email.toLowerCase(),
          },
        },
      },
      limit: 1,
    });

    if (searchResult.customers?.length) {
      // Already subscribed — return success (idempotent)
      return NextResponse.json({ success: true });
    }

    // Create new customer
    const createResult = await squareFetch<SquareCreateResponse>('/v2/customers', {
      email_address: email.toLowerCase(),
    });

    if (createResult.errors?.length) {
      logger.error('Square CreateCustomer errors:', createResult.errors);
      return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Newsletter signup failed:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
