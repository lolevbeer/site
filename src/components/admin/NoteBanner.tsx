/**
 * The "Note:" banner that the Event and Food date warnings (EventDateWarning,
 * FoodDateWarning) render as a field in the admin edit form. The .field-type
 * wrapper gives it Payload's standard space before the next field.
 */
import type { ComponentProps, ReactNode } from 'react'
import { Banner } from '@payloadcms/ui'

export function NoteBanner({
  type,
  children,
}: {
  type: ComponentProps<typeof Banner>['type']
  children: ReactNode
}) {
  return (
    <div className="field-type">
      <Banner type={type}>
        <strong>Note:</strong> <span>{children}</span>
      </Banner>
    </div>
  )
}
