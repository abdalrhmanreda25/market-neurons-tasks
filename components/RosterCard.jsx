'use client'

import { useEffect, useState } from 'react'
import { Avatar, Empty } from './ui'
import { rosterStatus } from '@/lib/team-seed'
import { getRoster, inviteRoster, saveRoster, subscribeRoster } from '@/lib/db'
import { friendlyError } from '@/lib/errors'

const STATE_STYLE = {
  joined: { label: 'On the team', color: '#14ae5c' },
  invited: { label: 'Invited', color: '#f5a623' },
  missing: { label: 'Not invited', color: '#9a9aa2' },
}

export default function RosterCard({ team, invites, canManage, invitedBy }) {
  const [roster, setRoster] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Seed the document the first time anyone opens the page.
    getRoster().catch(() => {})
    return subscribeRoster(setRoster)
  }, [])

  const rows = rosterStatus(roster, team, invites)
  const missing = rows.filter((r) => r.state === 'missing')

  const flash = (ok, text) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 4000)
  }

  const applyAll = async () => {
    setBusy(true)
    try {
      const results = await inviteRoster(team, missing, invitedBy)
      const added = results.filter((r) => r.ok && r.added).length
      const invited = results.filter((r) => r.ok && !r.added).length
      const failed = results.filter((r) => !r.ok)
      flash(
        !failed.length,
        `${added} added now, ${invited} invited for their first sign-in` +
          (failed.length ? ` · ${failed.length} skipped: ${failed.map((f) => f.email).join(', ')}` : '')
      )
    } catch (err) {
      flash(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const addRow = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveRoster([...(roster || []), { email, role }])
      setEmail('')
      flash(true, `${email.trim().toLowerCase()} added to the roster.`)
    } catch (err) {
      flash(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const setRowRole = (target, nextRole) =>
    saveRoster((roster || []).map((m) => (m.email === target ? { ...m, role: nextRole } : m))).catch((err) =>
      flash(false, friendlyError(err))
    )

  const removeRow = (target) =>
    saveRoster((roster || []).filter((m) => m.email !== target)).catch((err) =>
      flash(false, friendlyError(err))
    )

  if (roster === null) return null

  return (
    <section className="card" style={{ padding: '18px 6px' }}>
      <div className="card-head" style={{ padding: '0 12px' }}>
        <div>
          <div className="card-title">Market Neurons roster</div>
          <div className="card-sub">
            Shared list stored in Firestore · {rows.length} people
            {missing.length ? ` · ${missing.length} not invited yet` : ' · everyone invited'}
          </div>
        </div>
        {canManage && missing.length ? (
          <button className="btn btn-primary btn-sm" onClick={applyAll} disabled={busy}>
            {busy ? 'Inviting…' : `Invite ${missing.length} missing`}
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className={`alert ${toast.ok ? 'alert-ok' : 'alert-error'}`} style={{ margin: '0 12px 12px' }}>
          {toast.text}
        </div>
      ) : null}

      {rows.length ? (
        <table className="table">
          <tbody>
            {rows.map((row) => {
              const style = STATE_STYLE[row.state]
              return (
                <tr key={row.email}>
                  <td>
                    <div className="row">
                      <Avatar name={row.member?.displayName || row.email} seed={row.member?.uid || row.email} src={row.member?.photoURL} size="avatar-sm" />
                      <span className="small">{row.member?.displayName || row.email}</span>
                    </div>
                  </td>
                  <td className="faint small">{row.email}</td>
                  <td style={{ width: 130 }}>
                    {canManage ? (
                      <select
                        className="select"
                        style={{ maxWidth: 120, padding: '5px 10px', fontSize: 12.5 }}
                        value={row.role}
                        onChange={(e) => setRowRole(row.email, e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="small muted">{row.role === 'admin' ? 'Admin' : 'Member'}</span>
                    )}
                  </td>
                  <td style={{ width: 130 }}>
                    <span className="badge" style={{ background: `${style.color}1f`, color: style.color }}>
                      <span className="dot" style={{ background: style.color }} />
                      {style.label}
                    </span>
                  </td>
                  <td style={{ width: 40 }}>
                    {canManage ? (
                      <button className="btn btn-ghost btn-sm" title="Remove from roster"
                        onClick={() => removeRow(row.email)}>✕</button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <Empty title="The roster is empty" hint="Add the people who should be on every team." />
      )}

      {canManage ? (
        <form className="row wrap" style={{ gap: 8, padding: '14px 12px 0' }} onSubmit={addRow}>
          <input className="input" style={{ maxWidth: 280 }} type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="name@marketneurons.com" />
          <select className="select" style={{ maxWidth: 130 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn-sm" type="submit" disabled={busy}>Add to roster</button>
        </form>
      ) : null}
    </section>
  )
}
