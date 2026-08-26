'use client'

import { useEffect } from 'react'
import { priorityMeta, statusMeta } from '@/lib/constants'

const AVATAR_COLORS = ['#f4511e', '#f5a623', '#14ae5c', '#5b8def', '#7c5cff', '#e5322d', '#d97706', '#0ea5a4']

export function initials(name = '') {
  const parts = String(name).trim().split(/[\s@._-]+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function colorFor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function Avatar({ name, seed, src, size = '' }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`avatar ${size}`}
        src={src}
        alt={name || 'Member'}
        title={name}
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className={`avatar ${size}`} style={{ background: colorFor(seed || name || '') }} title={name}>
      {initials(name)}
    </div>
  )
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status)
  return (
    <span className="badge" style={{ background: `${meta.color}1f`, color: meta.color }}>
      <span className="dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const meta = priorityMeta(priority)
  return (
    <span className="badge" style={{ background: `${meta.color}1f`, color: meta.color }}>
      {meta.label}
    </span>
  )
}

export function StatCard({ label, value, hint, accent }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-lg' : ''}`}>
        <div className="between">
          <div>
            <h3 style={{ fontSize: 16 }}>{title}</h3>
            {subtitle ? <div className="card-sub" style={{ marginTop: 4 }}>{subtitle}</div> : null}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ full }) {
  if (full) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    )
  }
  return <div className="spinner" />
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>{title}</div>
      {hint ? <div style={{ marginBottom: 14 }}>{hint}</div> : null}
      {action}
    </div>
  )
}
