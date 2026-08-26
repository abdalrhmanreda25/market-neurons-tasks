'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { Avatar, Spinner } from '@/components/ui'
import { syncMemberProfile, updateProfile } from '@/lib/db'
import { fileToAvatarDataUrl } from '@/lib/avatar'
import { hours, memberWorkload } from '@/lib/analytics'
import { friendlyError } from '@/lib/errors'

const EMPTY = { displayName: '', title: '', phone: '', location: '', bio: '' }

export default function ProfilePage() {
  const { user, profile, changePassword, hasPasswordLogin } = useAuth()
  const { teams, members, tasks, timeLogs, myRole, loading } = useWorkspace()
  const fileInput = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)

  // Load the stored profile once it arrives, unless the user is mid-edit.
  useEffect(() => {
    if (!profile || dirty) return
    setForm({
      displayName: profile.displayName || '',
      title: profile.title || '',
      phone: profile.phone || '',
      location: profile.location || '',
      bio: profile.bio || '',
    })
    setPhoto(profile.photoURL || null)
  }, [profile, dirty])

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const set = (key) => (e) => {
    setDirty(true)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const flash = (ok, text) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 4000)
  }

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setPhoto(dataUrl)
      setDirty(true)
    } catch (err) {
      flash(false, err.message)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    const name = form.displayName.trim()
    if (!name) return flash(false, 'Your name cannot be empty.')
    setSaving(true)
    try {
      const patch = {
        displayName: name,
        title: form.title.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        photoURL: photo || null,
      }
      await updateProfile(user.uid, patch)
      // Teams cache name/photo/title on their member entry, so refresh those too.
      await syncMemberProfile(teams.map((t) => t.id), user.uid, {
        displayName: name,
        photoURL: photo || null,
        title: patch.title,
      })
      setDirty(false)
      flash(true, 'Profile saved.')
    } catch (err) {
      flash(false, friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (pw.next.length < 6) return flash(false, 'New password must be at least 6 characters.')
    if (pw.next !== pw.confirm) return flash(false, 'The two new passwords do not match.')
    setPwBusy(true)
    try {
      await changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      flash(true, 'Password updated.')
    } catch (err) {
      flash(false, friendlyError(err))
    } finally {
      setPwBusy(false)
    }
  }

  const mine = memberWorkload(members, tasks, timeLogs).find((m) => m.uid === user.uid)
  const canChangePassword = hasPasswordLogin()

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My profile</h1>
          <div className="page-sub">How you appear to the rest of the team</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </header>

      <div className="page" style={{ maxWidth: 820 }}>
        {toast ? <div className={`alert ${toast.ok ? 'alert-ok' : 'alert-error'}`}>{toast.text}</div> : null}

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Photo</div>
              <div className="card-sub">Square images work best — it is cropped and resized to 256px</div>
            </div>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <Avatar name={form.displayName || user.email} seed={user.uid} src={photo} size="avatar-lg" />
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}>
                Upload photo
              </button>
              {photo ? (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => { setPhoto(null); setDirty(true) }}
                >
                  Remove
                </button>
              ) : null}
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
            </div>
          </div>
        </section>

        <form className="card" onSubmit={save}>
          <div className="card-head">
            <div>
              <div className="card-title">Details</div>
              <div className="card-sub">Name and title show on tasks, comments and the team page</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" value={form.displayName} onChange={set('displayName')}
                placeholder="Your name" required />
            </div>
            <div className="field">
              <label className="label">Job title</label>
              <input className="input" value={form.title} onChange={set('title')}
                placeholder="Flutter Developer" />
            </div>
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')}
                placeholder="+20 100 000 0000" />
            </div>
            <div className="field">
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={set('location')}
                placeholder="Cairo, Egypt" />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="label">About</label>
            <textarea className="textarea" value={form.bio} onChange={set('bio')}
              placeholder="A short line about what you work on." />
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="label">Email</label>
            <input className="input" value={user.email || ''} disabled />
            <div className="faint small">
              Your sign-in email cannot be changed here — ask an owner if it needs updating.
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="btn btn-primary" type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Password</div>
              <div className="card-sub">
                {canChangePassword
                  ? 'You will be asked for your current password to confirm'
                  : 'This account signs in with Google'}
              </div>
            </div>
          </div>
          {canChangePassword ? (
            <form onSubmit={savePassword}>
              <div className="grid grid-3" style={{ gap: 14 }}>
                <div className="field">
                  <label className="label">Current password</label>
                  <input className="input" type="password" autoComplete="current-password" required
                    value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">New password</label>
                  <input className="input" type="password" autoComplete="new-password" required minLength={6}
                    value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">Confirm new password</label>
                  <input className="input" type="password" autoComplete="new-password" required minLength={6}
                    value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={pwBusy}>
                  {pwBusy ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          ) : (
            <div className="faint small">Manage your password through your Google account.</div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">Your activity</div>
            <div className="card-sub">Across the current team</div>
          </div>
          <div className="grid grid-4" style={{ gap: 12 }}>
            <div>
              <div className="stat-label">Role</div>
              <div className="stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>{myRole}</div>
            </div>
            <div>
              <div className="stat-label">Open tasks</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{mine?.open ?? 0}</div>
            </div>
            <div>
              <div className="stat-label">Completed</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{mine?.done ?? 0}</div>
            </div>
            <div>
              <div className="stat-label">Hours logged</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{hours(mine?.hours ?? 0)}</div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
