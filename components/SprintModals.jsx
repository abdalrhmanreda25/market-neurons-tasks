'use client'

import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Modal, PriorityBadge, StatusBadge } from './ui'
import { DEFAULT_SPRINT_DAYS } from '@/lib/constants'
import { formatDate, hours } from '@/lib/analytics'
import { friendlyError } from '@/lib/errors'

const today = () => format(new Date(), 'yyyy-MM-dd')

/* ----------------------------------------------------------- create / edit */

export function SprintForm({ initial, suggestedName, suggestedStart, onSubmit, onClose }) {
  const start = initial?.startDate || suggestedStart || today()
  const [form, setForm] = useState({
    name: initial?.name || suggestedName || '',
    goal: initial?.goal || '',
    startDate: start,
    endDate: initial?.endDate || format(addDays(new Date(`${start}T00:00:00`), DEFAULT_SPRINT_DAYS - 1), 'yyyy-MM-dd'),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const length =
    form.startDate && form.endDate
      ? Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1
      : 0

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit sprint' : 'Plan a sprint'}
      subtitle="A fixed window of work the team commits to."
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="field">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={set('name')} autoFocus placeholder="Sprint 1" />
        </div>
        <div className="field">
          <label className="label">Goal</label>
          <textarea className="textarea" style={{ minHeight: 70 }} value={form.goal} onChange={set('goal')}
            placeholder="What should be true when this sprint ends?" />
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label">Starts</label>
            <input className="input" type="date" required value={form.startDate} onChange={set('startDate')} />
          </div>
          <div className="field">
            <label className="label">Ends</label>
            <input className="input" type="date" required min={form.startDate} value={form.endDate} onChange={set('endDate')} />
          </div>
        </div>
        {length > 0 ? <div className="faint small">{length} day{length === 1 ? '' : 's'}</div> : null}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save sprint' : 'Create sprint'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------- complete */

export function CompleteSprintModal({ sprint, summary, plannedSprints, onConfirm, onClose }) {
  const [target, setTarget] = useState(plannedSprints[0]?.id ? 'sprint' : 'backlog')
  const [sprintId, setSprintId] = useState(plannedSprints[0]?.id || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setError('')
    setBusy(true)
    try {
      await onConfirm(target === 'sprint' ? sprintId : null)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Complete ${sprint.name}`} subtitle="Close the sprint and decide where unfinished work goes." onClose={onClose}>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid grid-3" style={{ gap: 10 }}>
        <div className="card" style={{ padding: 14, background: 'var(--bg-elev)' }}>
          <div className="stat-label">Done</div>
          <div className="stat-value" style={{ fontSize: 24, color: 'var(--green)' }}>{summary.done}</div>
        </div>
        <div className="card" style={{ padding: 14, background: 'var(--bg-elev)' }}>
          <div className="stat-label">Unfinished</div>
          <div className="stat-value" style={{ fontSize: 24, color: summary.open ? 'var(--amber)' : undefined }}>{summary.open}</div>
        </div>
        <div className="card" style={{ padding: 14, background: 'var(--bg-elev)' }}>
          <div className="stat-label">Completion</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{summary.completion}%</div>
        </div>
      </div>

      {summary.open ? (
        <div className="field">
          <span className="label">Move the {summary.open} unfinished task{summary.open === 1 ? '' : 's'} to</span>
          <label className="radio-row">
            <input type="radio" name="carry" checked={target === 'backlog'} onChange={() => setTarget('backlog')} />
            <span>The backlog</span>
          </label>
          <label className="radio-row" style={{ opacity: plannedSprints.length ? 1 : 0.5 }}>
            <input type="radio" name="carry" disabled={!plannedSprints.length}
              checked={target === 'sprint'} onChange={() => setTarget('sprint')} />
            <span>A planned sprint</span>
          </label>
          {target === 'sprint' ? (
            <select className="select" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
              {plannedSprints.map((s) => <option key={s.id} value={s.id}>{s.name} · starts {formatDate(s.startDate)}</option>)}
            </select>
          ) : null}
          {!plannedSprints.length ? <div className="faint small">Plan another sprint first to carry work straight into it.</div> : null}
        </div>
      ) : (
        <div className="alert alert-ok">Every task in this sprint is done.</div>
      )}

      <div className="faint small">Finished tasks stay attached to this sprint, so its history and velocity are kept.</div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-accent" onClick={confirm}
          disabled={busy || (target === 'sprint' && !sprintId)}>
          {busy ? 'Completing…' : 'Complete sprint'}
        </button>
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------- add from backlog */

export function AddTasksModal({ sprint, backlog, onConfirm, onClose }) {
  const [picked, setPicked] = useState(new Set())
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return backlog.filter((t) => !q || t.title.toLowerCase().includes(q))
  }, [backlog, search])

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allVisiblePicked = visible.length > 0 && visible.every((t) => picked.has(t.id))
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Set(prev)
      visible.forEach((t) => (allVisiblePicked ? next.delete(t.id) : next.add(t.id)))
      return next
    })

  const estimate = backlog.filter((t) => picked.has(t.id)).reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  const confirm = async () => {
    setError('')
    setBusy(true)
    try {
      await onConfirm([...picked])
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Add tasks to ${sprint.name}`} subtitle="Pull unfinished work in from the backlog." onClose={onClose} wide>
      {error ? <div className="alert alert-error">{error}</div> : null}

      {backlog.length ? (
        <>
          <div className="row wrap" style={{ gap: 10 }}>
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Search the backlog…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="btn btn-sm" onClick={toggleAll} disabled={!visible.length}>
              {allVisiblePicked ? 'Clear visible' : 'Select visible'}
            </button>
          </div>

          <div className="pick-list">
            {visible.map((t) => (
              <label key={t.id} className={`pick-row ${picked.has(t.id) ? 'selected' : ''}`}>
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="pick-title">{t.title}</span>
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="faint small" style={{ minWidth: 42, textAlign: 'right' }}>{hours(t.estimateHours)}</span>
              </label>
            ))}
            {!visible.length ? <div className="empty">No backlog tasks match.</div> : null}
          </div>
        </>
      ) : (
        <div className="empty">The backlog is empty — every open task is already in a sprint.</div>
      )}

      <div className="between wrap" style={{ gap: 10 }}>
        <span className="small muted">{picked.size} selected · {hours(estimate)} estimated</span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy || !picked.size}>
            {busy ? 'Adding…' : `Add ${picked.size || ''} to sprint`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
