'use client'

import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { ThemeToggle } from './ThemeProvider'
import { createTeam, getRoster, joinTeamByCode } from '@/lib/db'
import { friendlyError } from '@/lib/errors'

export default function Onboarding() {
  const { user, signOut } = useAuth()
  const [mode, setMode] = useState('create')
  const [inviteRoster, setInviteRoster] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'create') await createTeam(user, name, inviteRoster ? await getRoster() : null)
      else await joinTeamByCode(user, code)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-corner"><ThemeToggle /></div>
      <form className="auth-card" onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Market Neurons" width={48} height={48} />
          </div>
          <h1 className="auth-title">Set up your workspace</h1>
          <p className="auth-sub">Create your team or join your workspace.</p>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`btn btn-block ${mode === 'create' ? 'btn-primary' : ''}`}
            onClick={() => setMode('create')}>Create team</button>
          <button type="button" className={`btn btn-block ${mode === 'join' ? 'btn-primary' : ''}`}
            onClick={() => setMode('join')}>Join team</button>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {mode === 'create' ? (
          <>
            <div className="field">
              <label className="label" htmlFor="team">Team name</label>
              <input id="team" className="input" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Market Neurons" />
            </div>
            <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={inviteRoster} onChange={(e) => setInviteRoster(e.target.checked)} />
              <span className="muted">
                Invite the Market Neurons roster straight away
              </span>
            </label>
          </>
        ) : (
          <div className="field">
            <label className="label" htmlFor="code">Invite code</label>
            <input id="code" className="input" required value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123" style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }} />
          </div>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'create' ? 'Create team' : 'Join team'}
        </button>

        <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
      </form>
    </div>
  )
}
