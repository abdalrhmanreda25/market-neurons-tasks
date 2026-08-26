'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { useTheme } from '@/components/ThemeProvider'
import { Avatar, Spinner } from '@/components/ui'
import { createTeam, joinTeamByCode, removeMember, renameTeam, syncMemberName, updateProfile } from '@/lib/db'
import { friendlyError } from '@/lib/errors'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { team, teamId, teams, setActiveTeamId, canManage, myRole, loading } = useWorkspace()
  const { theme, setTheme } = useTheme()

  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [toast, setToast] = useState(null)

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const displayName = name || profile?.displayName || user.displayName || ''
  const currentTeamName = teamName || team?.name || ''

  const run = async (fn, message) => {
    try {
      await fn()
      setToast({ ok: true, text: message })
    } catch (err) {
      setToast({ ok: false, text: friendlyError(err) })
    }
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Your profile, workspace and appearance</div>
        </div>
      </header>

      <div className="page" style={{ maxWidth: 720 }}>
        {toast ? (
          <div className={`alert ${toast.ok ? 'alert-ok' : 'alert-error'}`}>{toast.text}</div>
        ) : null}

        <section className="card">
          <div className="card-head">
            <div className="card-title">Appearance</div>
            <div className="card-sub">Choose your preferred workspace theme</div>
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: theme === 'black' ? 'var(--accent)' : 'var(--border)',
                background: '#000000',
                color: '#ffffff',
                borderWidth: theme === 'black' ? 2 : 1,
              }}
              onClick={() => setTheme('black')}
            >
              <div className="between">
                <div style={{ fontWeight: 650 }}>🌙 Pure Black (Default)</div>
                {theme === 'black' ? <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Active</span> : null}
              </div>
              <div style={{ fontSize: 12, color: '#8b95a6', marginTop: 6 }}>
                Deep OLED black aesthetic for maximum focus and low-light comfort.
              </div>
            </div>

            <div
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: theme === 'light' ? 'var(--accent)' : 'var(--border)',
                background: '#ffffff',
                color: '#0f172a',
                borderWidth: theme === 'light' ? 2 : 1,
              }}
              onClick={() => setTheme('light')}
            >
              <div className="between">
                <div style={{ fontWeight: 650 }}>☀️ Light Mode</div>
                {theme === 'light' ? <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Active</span> : null}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Clean, crisp high-contrast light theme for bright environments.
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">Profile</div>
          </div>
          <div className="row" style={{ marginBottom: 16 }}>
            <Avatar name={displayName} seed={user.uid} src={profile?.photoURL} size="avatar-lg" />
            <div>
              <div style={{ fontWeight: 600 }}>{displayName}</div>
              <div className="faint small">{user.email}</div>
            </div>
          </div>
          <form
            className="row"
            style={{ gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const clean = displayName.trim()
                await updateProfile(user.uid, { displayName: clean })
                await syncMemberName(teams.map((t) => t.id), user.uid, clean)
              }, 'Profile updated.')
            }}
          >
            <input className="input" value={displayName} onChange={(e) => setName(e.target.value)}
              placeholder="Display name" />
            <button className="btn btn-primary" type="submit">Save</button>
          </form>
          <div className="faint small" style={{ marginTop: 8 }}>
            The name your teammates see on tasks, comments and time entries.
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Workspace</div>
              <div className="card-sub">You are {myRole === 'owner' ? 'the owner' : `an ${myRole}`} of {team?.name}</div>
            </div>
          </div>
          <form
            className="row"
            style={{ gap: 10, marginBottom: 14 }}
            onSubmit={(e) => {
              e.preventDefault()
              run(() => renameTeam(teamId, currentTeamName), 'Team renamed.')
            }}
          >
            <input className="input" value={currentTeamName} disabled={!canManage}
              onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" />
            <button className="btn btn-primary" type="submit" disabled={!canManage}>Rename</button>
          </form>
          <div className="between card" style={{ background: 'var(--bg-elev)' }}>
            <div>
              <div className="label">Invite code</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
                {team?.inviteCode}
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(team?.inviteCode || '')}>
              Copy
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Your teams</div>
              <div className="card-sub">{teams.length} workspace{teams.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {teams.map((t) => (
              <div key={t.id} className="between card" style={{ background: 'var(--bg-elev)', padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                  <div className="faint small">{(t.memberIds || []).length} members</div>
                </div>
                <div className="row">
                  {t.id === teamId ? (
                    <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Active</span>
                  ) : (
                    <button className="btn btn-sm" onClick={() => setActiveTeamId(t.id)}>Switch</button>
                  )}
                  {t.ownerId !== user.uid ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        window.confirm(`Leave ${t.name}?`) &&
                        run(() => removeMember(t.id, user.uid), `Left ${t.name}.`)
                      }
                    >
                      Leave
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ gap: 12 }}>
            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  const id = await createTeam(user, newTeam)
                  setActiveTeamId(id)
                  setNewTeam('')
                }, 'Team created.')
              }}
            >
              <label className="label">Create another team</label>
              <input className="input" required value={newTeam} onChange={(e) => setNewTeam(e.target.value)}
                placeholder="Team name" />
              <button className="btn btn-sm" type="submit" style={{ marginTop: 6 }}>Create</button>
            </form>

            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  const id = await joinTeamByCode(user, joinCode)
                  setActiveTeamId(id)
                  setJoinCode('')
                }, 'Joined the team.')
              }}
            >
              <label className="label">Join with a code</label>
              <input className="input" required value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123"
                style={{ letterSpacing: '0.16em' }} />
              <button className="btn btn-sm" type="submit" style={{ marginTop: 6 }}>Join</button>
            </form>
          </div>
        </section>
      </div>
    </>
  )
}
