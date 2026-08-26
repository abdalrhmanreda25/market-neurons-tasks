'use client'

import { useState } from 'react'
import { Modal } from './ui'
import { PRIORITIES, STATUSES } from '@/lib/constants'
import { friendlyError } from '@/lib/errors'

export default function TaskForm({ initial, members, onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    status: initial?.status || 'todo',
    priority: initial?.priority || 'medium',
    assigneeId: initial?.assigneeId || '',
    dueDate: initial?.dueDate || '',
    estimateHours: initial?.estimateHours || '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Give the task a title.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({
        ...form,
        assigneeId: form.assigneeId || null,
        dueDate: form.dueDate || null,
        estimateHours: Number(form.estimateHours) || 0,
      })
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit task' : 'New task'}
      subtitle={initial ? 'Update the details of this task.' : 'Add work to the board.'}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={set('title')} autoFocus
            placeholder="Ship the pricing page" />
        </div>

        <div className="field">
          <label className="label">Description</label>
          <textarea className="textarea" value={form.description} onChange={set('description')}
            placeholder="What needs to happen, and what does done look like?" />
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Priority</label>
            <select className="select" value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Assignee</label>
            <select className="select" value={form.assigneeId} onChange={set('assigneeId')}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Due date</label>
            <input className="input" type="date" value={form.dueDate || ''} onChange={set('dueDate')} />
          </div>
        </div>

        <div className="field">
          <label className="label">Estimated hours</label>
          <input className="input" type="number" min="0" step="0.5" value={form.estimateHours}
            onChange={set('estimateHours')} placeholder="0" />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
