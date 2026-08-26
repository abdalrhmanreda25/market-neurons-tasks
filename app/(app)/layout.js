'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import WorkspaceProvider, { useWorkspace } from '@/components/WorkspaceProvider'
import Sidebar from '@/components/Sidebar'
import Onboarding from '@/components/Onboarding'
import { Spinner } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeProvider'

function Shell({ children }) {
  const { teams, teamsLoaded, error } = useWorkspace()
  const [navOpen, setNavOpen] = useState(false)

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-title">Could not load your workspace</h1>
          <div className="alert alert-error">
            {error.code === 'permission-denied'
              ? 'Firestore denied the request. Deploy firestore.rules with: npx firebase-tools deploy --only firestore:rules'
              : `${error.code || 'error'}: ${error.message}`}
          </div>
          <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }
  if (!teamsLoaded) return <Spinner full />
  if (!teams.length) return <Onboarding />

  return (
    <div className="shell">
      <button
        type="button"
        className={`nav-scrim ${navOpen ? 'show' : ''}`}
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      <div className="main">
        {/* Only shown on small screens, where the sidebar is a drawer. */}
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.svg" alt="Market Neurons" width={26} height={26} />
          <span className="mobile-bar-title">Market Neurons</span>
          <span className="spacer" />
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  )
}

export default function AppLayout({ children }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) return <Spinner full />

  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  )
}
