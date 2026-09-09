/**
 * Off-screen honeypot. Named so password managers do not treat it as a website.
 */

import { Input } from '@/components/ui/input'

export function HoneypotField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
      <Input
        name="company_url_hp"
        tabIndex={-1}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Leave blank"
      />
    </div>
  )
}
