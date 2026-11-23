/**
 * Widths the image optimizer accepts. next.config.mjs reads these, and the
 * proxy maps widths that older pages still ask for onto them.
 *
 * Next's default is 8 device widths; every url x width x format is a billed
 * transform, so the site keeps 5. 2560 still covers full-bleed images on retina
 * laptops.
 */
export const IMAGE_DEVICE_SIZES = [640, 828, 1200, 1920, 2560]

/** Next's default imageSizes, left unchanged. Listed so the proxy knows them. */
export const IMAGE_SIZES = [32, 48, 64, 96, 128, 256, 384]
