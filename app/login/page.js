'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ThemeToggle } from '@/components/ThemeProvider'
import { Spinner } from '@/components/ui'
import { friendlyError } from '@/lib/errors'

export default function LoginPage() {
  const { user, loading, signIn, signInWithGoogle, resetPassword } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  if (loading || user) return <Spinner full />

  const run = async (fn) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-corner"><ThemeToggle /></div>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.svg" alt="Market Neurons" width={60} height={60} />
          <div>
            <h1 className="auth-title" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>Market Neurons</h1>
            <p className="auth-sub" style={{ fontSize: 13, marginTop: 4 }}>
              Workspace for authorized team members
            </p>
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-ok">{notice}</div> : null}

        {/* Primary Google Login Button */}
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ padding: '11px 16px', fontSize: 14, fontWeight: 600, gap: 10 }}
          disabled={busy}
          onClick={() => run(signInWithGoogle)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#ffffff"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#ffffff"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#ffffff"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#ffffff"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="divider" style={{ margin: '4px 0' }}>or with email</div>

        {!showEmailForm ? (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => setShowEmailForm(true)}
            style={{ fontSize: 13 }}
          >
            Sign in with email & password
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(() => signIn(email, password))
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}
          >
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@marketneurons.com"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="between small" style={{ marginTop: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  email
                    ? run(async () => {
                        await resetPassword(email)
                        setNotice('Password reset email sent.')
                      })
                    : setError('Enter your email first, then click reset.')
                }
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm faint"
                onClick={() => setShowEmailForm(false)}
              >
                Hide
              </button>
            </div>
          </form>
        )}

        <div className="faint small" style={{ marginTop: 6, lineHeight: 1.4 }}>
          New members are added directly by team administrators.
        </div>
      </div>
    </div>
  )
}
