import { NextResponse } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ url: string }> }
) {
  try {
    const { url } = await params
    const menu = await getMenuByUrl(url)

    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(menu)
  } catch (error) {
    console.error('Error fetching menu:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
