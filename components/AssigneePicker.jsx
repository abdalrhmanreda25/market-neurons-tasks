'use client'

import { Avatar } from './ui'

/** Toggle-chip multi-select for task assignees. */
export default function AssigneePicker({ members, value = [], onChange }) {
  const selected = new Set(value)

  const toggle = (uid) => {
    const next = new Set(selected)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    // Keep team order rather than click order, so the stack is stable.
    onChange(members.map((m) => m.uid).filter((id) => next.has(id)))
  }

  return (
    <div>
      <div className="chip-group" role="group" aria-label="Assignees">
        {members.map((m) => {
          const on = selected.has(m.uid)
          return (
            <button
              key={m.uid}
              type="button"
              className={`chip ${on ? 'selected' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(m.uid)}
            >
              <Avatar name={m.displayName || m.email} seed={m.uid} src={m.photoURL} size="avatar-xs" />
              <span>{m.displayName || m.email}</span>
              {on ? <span className="chip-check" aria-hidden>✓</span> : null}
            </button>
          )
        })}
      </div>
      <div className="row small faint" style={{ marginTop: 8, gap: 10 }}>
        <span>{value.length ? `${value.length} assigned` : 'Nobody assigned'}</span>
        {value.length ? (
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}
