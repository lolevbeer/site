import React from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { DonationRequestInput, Page1GateKey } from '@/lib/donate/donation-request'
import type { SetDonationField } from './form-shared'

export function EligibilityStep({
  panelRef,
  gates,
  values,
  set,
  canContinue,
  onContinue,
}: {
  panelRef: React.Ref<HTMLFieldSetElement>
  gates: ReadonlyArray<{ key: Page1GateKey; label: string }>
  values: DonationRequestInput
  set: SetDonationField
  canContinue: boolean
  onContinue: () => void
}) {
  return (
    <fieldset ref={panelRef} tabIndex={-1} className="space-y-4 outline-none">
      <legend className="sr-only">Eligibility</legend>
      <p className="text-muted-foreground text-pretty">
        We get more donation asks than we can fill. This form is the only way to request beer or a
        fundraiser night. Phone, email, and Instagram do not count. Every switch is required.
      </p>
      {gates.map((gate) => (
        <div key={gate.key} className="flex gap-3 items-start">
          <Switch
            id={gate.key}
            className="mt-0.5"
            checked={values[gate.key]}
            onCheckedChange={(checked) => set(gate.key, checked)}
          />
          <label htmlFor={gate.key} className="text-sm leading-snug cursor-pointer">
            {gate.label}
          </label>
        </div>
      ))}
      <div className="flex justify-end pt-4">
        <Button type="button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </fieldset>
  )
}
