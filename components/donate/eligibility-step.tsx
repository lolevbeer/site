import React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'
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
    <FieldSet ref={panelRef} tabIndex={-1} className="overflow-visible outline-none">
      <legend className="sr-only">Eligibility</legend>
      <p className="text-muted-foreground text-pretty">
        We get more donation asks than we can fill. This form is the only way to request beer or a
        fundraiser night. Phone, email, and Instagram do not count. Every switch is required.
      </p>
      <FieldGroup className="overflow-visible p-1">
        {gates.map((gate) => (
          <Field key={gate.key} orientation="horizontal">
            <Switch
              id={gate.key}
              checked={values[gate.key]}
              onCheckedChange={(checked) => set(gate.key, checked)}
            />
            <FieldLabel htmlFor={gate.key} className="font-normal">
              {gate.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      <div className="flex justify-end pt-4">
        <Button type="button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </FieldSet>
  )
}
