'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { Avatar, Empty, Modal, Spinner } from '@/components/ui'
import { NOTE_CATEGORIES, noteCategoryMeta } from '@/lib/constants'
import { acknowledgeNote, createNote, deleteNote, setNotePinned, subscribeNotes, updateNote } from '@/lib/db'
import { formatTimestamp } from '@/lib/analytics'
import { friendlyError } from '@/lib/errors'

const TABS = [
  { id: 'guideline', label: 'Guidelines' },
  { id: 'note', label: 'Notes' },
]

const millis = (ts) => (ts?.toMillis ? ts.toMillis() : ts ? new Date(ts).getTime() : Date.now())

export default function NotesPage() {
  const { user } = useAuth()
  const { teamId, team, members, memberPhoto, loading } = useWorkspace()

  const [notes, setNotes] = useState([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [tab, setTab] = useState('guideline')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { kind, note? }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!teamId) return undefined
    setNotesLoaded(false)
    return subscribeNotes(
      teamId,
      (list) => {
        setNotes(list)
        setNotesLoaded(true)
      },
      () => setNotesLoaded(true)
    )
  }, [teamId])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return notes
      .filter((n) => (n.kind || 'note') === tab)
      .filter((n) => category === 'all' || n.category === category)
      .filter((n) => !term || `${n.title} ${n.body}`.toLowerCase().includes(term))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || millis(b.createdAt) - millis(a.createdAt))
  }, [notes, tab, category, search])

  if (loading || !notesLoaded) return <div style={{ padding: 60 }}><Spinner /></div>

  const guidelines = notes.filter((n) => n.kind === 'guideline')
  const unread = guidelines.filter((n) => !(n.ackBy || []).includes(user.uid)).length
  const count = (kind) => notes.filter((n) => (n.kind || 'note') === kind).length

  const flash = (ok, text) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 4000)
  }
  const run = async (fn, message) => {
    try {
      await fn()
      if (message) flash(true, message)
    } catch (err) {
      flash(false, friendlyError(err))
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Notes & Guidelines</h1>
          <div className="page-sub">
            How {team?.name || 'the team'} works, and what everyone should know
            {unread ? ` · ${unread} guideline${unread === 1 ? '' : 's'} you haven't read` : ''}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setModal({ kind: tab })}>
            + {tab === 'guideline' ? 'Add guideline' : 'Add note'}
          </button>
        </div>
      </header>

      <div className="page">
        {toast ? <div className={`alert ${toast.ok ? 'alert-ok' : 'alert-error'}`}>{toast.text}</div> : null}

        <div className="between wrap">
          <div className="segmented" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} role="tab"
                aria-selected={tab === t.id}>
                {t.label} ({count(t.id)})
              </button>
            ))}
          </div>
          <div className="row wrap">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            <select className="select" style={{ width: 170 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {NOTE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {!visible.length ? (
          <div className="card">
            <Empty
              title={search || category !== 'all'
                ? 'Nothing matches those filters'
                : tab === 'guideline' ? 'No guidelines yet' : 'No notes yet'}
              hint={tab === 'guideline'
                ? 'Write down how the team works: workflow, code review, communication, onboarding.'
                : 'Share decisions, links, meeting takeaways or anything the team should remember.'}
              action={!search && category === 'all' ? (
                <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: tab })}>
                  + {tab === 'guideline' ? 'Add the first guideline' : 'Add the first note'}
                </button>
              ) : null}
            />
          </div>
        ) : (
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            {visible.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                uid={user.uid}
                memberCount={members.length}
                photo={memberPhoto(n.authorId)}
                onEdit={() => setModal({ kind: n.kind || 'note', note: n })}
                onPin={() => run(() => setNotePinned(teamId, n.id, !n.pinned))}
                onAck={(read) => run(() => acknowledgeNote(teamId, n.id, user.uid, read))}
                onDelete={() =>
                  window.confirm(`Delete "${n.title}"?`) && run(() => deleteNote(teamId, n.id), 'Deleted.')
                }
              />
            ))}
          </div>
        )}
      </div>

      {modal ? (
        <NoteForm
          kind={modal.kind}
          initial={modal.note}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            if (modal.note) await updateNote(teamId, modal.note.id, data)
            else await createNote(teamId, { ...data, kind: modal.kind }, user)
            flash(true, modal.note ? 'Saved.' : `${modal.kind === 'guideline' ? 'Guideline' : 'Note'} published.`)
          }}
        />
      ) : null}
    </>
  )
}

function NoteCard({ note, uid, memberCount, photo, onEdit, onPin, onAck, onDelete }) {
  const cat = noteCategoryMeta(note.category)
  const isGuideline = note.kind === 'guideline'
  const acks = note.ackBy || []
  const readByMe = acks.includes(uid)
  const [expanded, setExpanded] = useState(false)
  const long = (note.body || '').length > 360

  return (
    <section className="card" style={note.pinned ? { borderColor: 'var(--accent-ring)' } : undefined}>
      <div className="between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {note.pinned ? <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>📌 Pinned</span> : null}
          <span className="badge" style={{ background: `${cat.color}1f`, color: cat.color }}>
            <span className="dot" style={{ background: cat.color }} />
            {cat.label}
          </span>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={onPin}
            title={note.pinned ? 'Unpin' : 'Pin to top'}>
            {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={onEdit}>Edit</button>
          <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="card-title" style={{ fontSize: 15.5, marginBottom: 8 }}>{note.title}</div>
      <div className="comment-text" style={{ marginTop: 0 }}>
        {long && !expanded ? `${note.body.slice(0, 360).trimEnd()}…` : note.body}
      </div>
      {long ? (
        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 0', marginTop: 4 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}

      <div className="between wrap" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Avatar name={note.authorName} seed={note.authorId} src={photo} size="avatar-xs" />
          <span className="faint" style={{ fontSize: 11.5 }}>
            {note.authorName} · {formatTimestamp(note.createdAt) || 'just now'}
          </span>
        </div>
        {isGuideline ? (
          <div className="row" style={{ gap: 8 }}>
            <span className="faint" style={{ fontSize: 11.5 }}>
              Read by {acks.length}/{memberCount}
            </span>
            <button
              className={`btn btn-sm ${readByMe ? 'btn-ghost' : 'btn-accent'}`}
              style={{ padding: '4px 10px' }}
              onClick={() => onAck(!readByMe)}
            >
              {readByMe ? '✓ Read' : 'Mark as read'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function NoteForm({ kind, initial, onClose, onSubmit }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [category, setCategory] = useState(initial?.category || (kind === 'guideline' ? 'process' : 'general'))
  const [pinned, setPinned] = useState(Boolean(initial?.pinned))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const noun = kind === 'guideline' ? 'guideline' : 'note'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit({ title, body, category, pinned })
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={initial ? `Edit ${noun}` : `New ${noun}`}
      subtitle={kind === 'guideline'
        ? 'Guidelines are the team’s agreed way of working. Everyone on the team can add, edit and mark them as read.'
        : 'Notes are visible to everyone on the team.'}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label className="label">Title</label>
          <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'guideline' ? 'e.g. Pull requests need one review before merging' : 'e.g. Sprint 4 retro takeaways'} />
        </div>

        <div className="field">
          <label className="label">Category</label>
          <div className="chip-group">
            {NOTE_CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={`chip ${category === c.id ? 'selected' : ''}`}
                onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Details</label>
          <textarea className="textarea" required style={{ minHeight: 200 }} value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === 'guideline'
              ? 'What is expected, why it matters, and any examples…'
              : 'Write your note…'} />
        </div>

        <label className="radio-row">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top
        </label>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || !body.trim()}>
            {busy ? 'Saving…' : initial ? 'Save changes' : `Publish ${noun}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
