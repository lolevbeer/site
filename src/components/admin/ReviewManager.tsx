'use client'

import { useField, FieldLabel } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'
import { Eye, EyeOff } from 'lucide-react'

interface UntappdReview {
  username: string
  rating: number
  text: string
  date?: string
  url?: string
  image?: string
  hidden?: boolean
}

export function ReviewManager(props: JSONFieldClientProps) {
  const { field, path } = props
  const { value, setValue } = useField<UntappdReview[]>({ path })

  const reviews = value || []

  const toggleHidden = (index: number) => {
    const updated = reviews.map((review, i) =>
      i === index ? { ...review, hidden: !review.hidden } : review
    )
    setValue(updated)
  }

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const truncateText = (text: string, maxLength = 60) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <FieldLabel label={field.label || field.name} path={path} />
        <span style={{ fontSize: '12px', color: 'var(--theme-elevation-500)' }}>
          {reviews.filter(r => !r.hidden).length} visible / {reviews.length} total
        </span>
      </div>
      {reviews.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--theme-elevation-500)', fontStyle: 'italic' }}>
          No reviews yet
        </div>
      ) : [...reviews]
        .map((review, idx) => ({ ...review, _idx: idx }))
        .sort((a, b) => {
          if (!a.date || !b.date) return 0
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        }).map((review) => (
        <div
          key={review.url || `${review.username}-${review.date}-${review._idx}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderBottom: '1px solid var(--theme-elevation-100)',
            gap: '12px',
            opacity: review.hidden ? 0.5 : 1,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: 600 }}>{review.username}</span>
              {review.date && (
                <span style={{ fontSize: '12px', color: 'var(--theme-elevation-500)' }}>
                  {formatRelativeTime(review.date)}
                </span>
              )}
              <span style={{
                fontSize: '12px',
                color: 'var(--theme-elevation-500)',
                background: 'var(--theme-elevation-50)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                ★ {review.rating.toFixed(1)}
              </span>
              {review.hidden && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--theme-error-500)',
                  fontWeight: 500
                }}>
                  Hidden
                </span>
              )}
            </div>
            {review.text && (
              <div style={{ fontSize: '13px', color: 'var(--theme-elevation-700)', lineHeight: '1.4' }}>
                {truncateText(review.text)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleHidden(review._idx)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: review.hidden ? 'var(--theme-success-500)' : 'var(--theme-elevation-400)',
              flexShrink: 0,
            }}
            title={review.hidden ? 'Show review' : 'Hide review'}
          >
            {review.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      ))}
    </div>
  )
}
