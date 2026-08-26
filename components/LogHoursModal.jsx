'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Modal } from './ui'
import { friendlyError } from '@/lib/errors'

export default function LogHoursModal({ task, tasks, onSubmit, onClose }) {
  const [form, setForm] = useState({
    hours: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
    taskId: task?.id || '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const picked = tasks?.find((t) => t.id === form.taskId)
      await onSubmit({ ...form, taskTitle: task?.title || picked?.title || 'General work' })
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Log hours" subtitle={task ? task.title : 'Record time against a task.'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error ? <div className="alert alert-error">{error}</div> : null}

        {!task && tasks ? (
          <div className="field">
            <label className="label">Task</label>
            <select className="select" value={form.taskId} onChange={set('taskId')}>
              <option value="">General work (no task)</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        ) : null}

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label">Hours</label>
            <input className="input" type="number" min="0.25" step="0.25" required autoFocus
              value={form.hours} onChange={set('hours')} placeholder="2.5" />
          </div>
          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date" required value={form.date} onChange={set('date')} />
          </div>
        </div>

        <div className="field">
          <label className="label">Note (optional)</label>
          <input className="input" value={form.note} onChange={set('note')} placeholder="What did you work on?" />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Log hours'}</button>
        </div>
      </form>
    </Modal>
  )
}
