import { IMAGE_DEVICE_SIZES, IMAGE_SIZES } from '@/lib/config/image-sizes.mjs'

const ALLOWED_WIDTHS = [...IMAGE_SIZES, ...IMAGE_DEVICE_SIZES].sort((a, b) => a - b)

/**
 * Next's old default device widths, dropped on Nov 12 2026. Pages rendered
 * before that (restored tabs, cached HTML, crawler indexes) still request
 * them, and the optimizer answers 400.
 */
export const RETIRED_IMAGE_WIDTHS = [750, 1080, 2048, 3840] as const

/**
 * The allowed width to send a request for `width` to: the smallest allowed
 * width at least as wide, as Next itself picks, or the widest there is.
 * Null when `width` is already allowed or isn't a positive whole number.
 */
export function allowedImageWidthFor(width: number): number | null {
  if (!Number.isInteger(width) || width <= 0) return null
  if (ALLOWED_WIDTHS.includes(width)) return null
  return ALLOWED_WIDTHS.find((allowed) => allowed >= width) ?? ALLOWED_WIDTHS.at(-1)!
}
