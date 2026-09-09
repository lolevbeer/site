/**
 * Public food agenda. Thin wrapper over ScheduleList so server pages pass
 * vendor fields without a render function.
 */
import { ScheduleList } from '@/components/ui/schedule-list'

export interface FoodScheduleItem {
  id: string
  date: string
  vendor: string
  time?: string | null
  site?: string
  logoUrl?: string
  locationName?: string
}

export function FoodSchedule({ items }: { items: FoodScheduleItem[] }) {
  return (
    <ScheduleList
      items={items.map((item) => ({
        id: item.id,
        date: item.date,
        title: item.vendor,
        time: item.time,
        site: item.site,
        imageUrl: item.logoUrl,
        locationName: item.locationName,
      }))}
    />
  )
}
