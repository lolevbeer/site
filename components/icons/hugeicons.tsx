/**
 * Site icon set, backed by Hugeicons (free set).
 *
 * Exports components under the lucide-react names the codebase already uses,
 * so call sites render icons as plain components (`<Search className=... />`)
 * without knowing about the HugeiconsIcon wrapper API. Add new icons here
 * rather than importing @hugeicons/* directly in components.
 */
'use client'

import React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  BeerIcon,
  Calendar01Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  Edit03Icon,
  FacebookIcon,
  GpsIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  InstagramIcon,
  LinkSquare02Icon,
  ListViewIcon,
  Location01Icon,
  Mail01Icon,
  MapIcon as HugeMapIcon,
  MonitorIcon,
  Moon02Icon,
  MoreHorizontalIcon,
  Navigation01Icon,
  PackageIcon,
  RestaurantIcon,
  Search01Icon,
  Sun03Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'

type IconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, 'icon'>

/** Component type for icon-as-prop patterns (replaces lucide's LucideIcon). */
export type LucideIcon = React.ComponentType<IconProps>

function icon(svg: React.ComponentProps<typeof HugeiconsIcon>['icon']): LucideIcon {
  const Icon = (props: IconProps) => <HugeiconsIcon icon={svg} {...props} />
  return Icon
}

export const AlertCircle = icon(AlertCircleIcon)
export const Beer = icon(BeerIcon)
export const Calendar = icon(Calendar01Icon)
export const CircleX = icon(CancelCircleIcon)
export const ExternalLink = icon(LinkSquare02Icon)
export const Facebook = icon(FacebookIcon)
export const HelpCircle = icon(HelpCircleIcon)
export const Info = icon(InformationCircleIcon)
export const Instagram = icon(InstagramIcon)
export const List = icon(ListViewIcon)
export const Locate = icon(GpsIcon)
export const Mail = icon(Mail01Icon)
export const Map = icon(HugeMapIcon)
export const MapPin = icon(Location01Icon)
export const Navigation = icon(Navigation01Icon)
export const Package = icon(PackageIcon)
export const Pencil = icon(Edit03Icon)
export const Phone = icon(Call02Icon)
export const Search = icon(Search01Icon)
export const Monitor = icon(MonitorIcon)
export const Moon = icon(Moon02Icon)
export const Sun = icon(Sun03Icon)
export const Utensils = icon(RestaurantIcon)
export const UtensilsCrossed = icon(RestaurantIcon)
export const X = icon(Cancel01Icon)

// shadcn/ui primitives (accordion, dialog, breadcrumb, select, carousel)
export const ArrowLeft = icon(ArrowLeft02Icon)
export const ArrowRight = icon(ArrowRight02Icon)
export const Check = icon(Tick02Icon)
export const CheckIcon = Check
export const ChevronDown = icon(ArrowDown01Icon)
export const ChevronDownIcon = ChevronDown
export const ChevronRight = icon(ArrowRight01Icon)
export const ChevronUp = icon(ArrowUp01Icon)
export const ChevronUpIcon = ChevronUp
export const MoreHorizontal = icon(MoreHorizontalIcon)
export const XIcon = X
