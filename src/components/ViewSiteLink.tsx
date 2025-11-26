'use client'

import React from 'react'

export const ViewSiteLink: React.FC = () => {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      title="View Site"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--theme-elevation-600)',
        padding: '8px',
        borderRadius: '4px',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--theme-text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--theme-elevation-600)'
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </a>
  )
}
