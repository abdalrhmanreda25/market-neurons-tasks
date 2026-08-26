'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { useChartTheme } from '@/components/ThemeProvider'
import { Avatar, Empty, Modal, Spinner } from '@/components/ui'
import RosterCard from '@/components/RosterCard'
import { ROLES } from '@/lib/constants'
import { cancelInvite, inviteMember, removeMember, setMemberRole, subscribeTeamInvites } from '@/lib/db'
import { hours, memberWorkload } from '@/lib/analytics'
import { friendlyError } from '@/lib/errors'


export default function TeamPage() {
  const { user } = useAuth()
  const { team, teamId, members, tasks, timeLogs, canManage, myRole, loading } = useWorkspace()
  const chart = useChartTheme()
  const [invites, setInvites] = useState([])
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!teamId) return undefined
    return subscribeTeamInvites(teamId, setInvites)
  }, [teamId])

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const workload = memberWorkload(members, tasks, timeLogs)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(team.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Team</h1>
          <div className="page-sub">{members.length} member{members.length === 1 ? '' : 's'} in {team?.name}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={copyCode}>
            {copied ? '✓ Copied' : `Invite code: ${team?.inviteCode}`}
          </button>
          {canManage ? <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add member</button> : null}
        </div>
      </header>

      <div className="page">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Workload by member</div>
              <div className="card-sub">Open vs completed tasks, and hours logged</div>
            </div>
          </div>
          {members.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workload} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="name" {...chart.axis} tickLine={false} interval={0} />
                <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={chart.cursor}
                  contentStyle={chart.tooltip}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                <Bar dataKey="open" name="Open tasks" stackId="t" fill="#f5a623" />
                <Bar dataKey="done" name="Done tasks" stackId="t" fill="#14ae5c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hours" name="Hours logged" fill={chart.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty title="No members yet" />}
        </section>

        <section className="card" style={{ padding: '18px 6px' }}>
          <div className="card-head" style={{ padding: '0 12px' }}>
            <div className="card-title">Members</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Open</th>
                <th>Done</th>
                <th>Hours</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {workload.map((m) => {
                const isOwner = m.role === 'owner'
                return (
                  <tr key={m.uid}>
                    <td>
                      <div className="row">
                        <Avatar name={m.name} seed={m.uid} src={members.find((x) => x.uid === m.uid)?.photoURL} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                            {m.name}{m.uid === user.uid ? <span className="faint small"> (you)</span> : null}
                          </div>
                          <div className="faint" style={{ fontSize: 11.5 }}>
                            {members.find((x) => x.uid === m.uid)?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {canManage && !isOwner ? (
                        <select
                          className="select"
                          style={{ maxWidth: 130, padding: '5px 10px', fontSize: 12.5 }}
                          value={m.role}
                          onChange={(e) => setMemberRole(teamId, m.uid, e.target.value)}
                        >
                          {ROLES.filter((r) => r.id !== 'owner').map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>
                          {ROLES.find((r) => r.id === m.role)?.label || 'Member'}
                        </span>
                      )}
                    </td>
                    <td className="muted">{m.open}</td>
                    <td className="muted">{m.done}</td>
                    <td style={{ fontWeight: 600 }}>{hours(m.hours)}</td>
                    <td style={{ width: 90 }}>
                      {canManage && !isOwner && m.uid !== user.uid ? (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            window.confirm(`Remove ${m.name} from ${team.name}?`) && removeMember(teamId, m.uid)
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <RosterCard team={team} invites={invites} canManage={canManage} invitedBy={user.uid} />

        {invites.length ? (
          <section className="card" style={{ padding: '18px 6px' }}>
            <div className="card-head" style={{ padding: '0 12px' }}>
              <div>
                <div className="card-title">Pending invites</div>
                <div className="card-sub">They join automatically on their first sign-in</div>
              </div>
            </div>
            <table className="table">
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td className="muted">{ROLES.find((r) => r.id === invite.role)?.label || 'Member'}</td>
                    <td style={{ width: 90, textAlign: 'right' }}>
                      {canManage ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => cancelInvite(invite.id)}>Cancel</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {!canManage ? (
          <div className="faint small">You are a {myRole}. Ask an owner or admin to add members.</div>
        ) : null}
      </div>

      {adding ? <AddMemberModal team={team} onClose={() => setAdding(false)} invitedBy={user.uid} /> : null}
    </>
  )
}

function AddMemberModal({ team, invitedBy, onClose }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await inviteMember(team, email, role, invitedBy)
      setNotice(
        result.added
          ? `${result.email} has been added to the team.`
          : `Invite saved for ${result.email}. They join as soon as they sign up.`
      )
      setEmail('')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a team member" subtitle="Invite by email, or share the team's invite code." onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-ok">{notice}</div> : null}

        <div className="field">
          <label className="label">Email address</label>
          <input className="input" type="email" required autoFocus value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
        </div>

        <div className="field">
          <label className="label">Role</label>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member — can work on tasks and log hours</option>
            <option value="admin">Admin — can also manage the team</option>
          </select>
        </div>

        <div className="card" style={{ background: 'var(--bg-elev)', padding: 14 }}>
          <div className="card-sub">Or share this invite code</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', marginTop: 6 }}>
            {team.inviteCode}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Done</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
