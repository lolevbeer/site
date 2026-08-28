/** Shared category metadata for the Payload field and fullscreen menu renderer. */
export const OTHER_MENU_CATEGORIES = [
  { label: 'Cocktails & Cider', value: 'cocktails-cider' },
  { label: 'Soft Drinks', value: 'soft-drinks' },
  { label: 'Snacks & Merch', value: 'snacks-merch' },
] as const

export type OtherMenuCategory = (typeof OTHER_MENU_CATEGORIES)[number]['value']
