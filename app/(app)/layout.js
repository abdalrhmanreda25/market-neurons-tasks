'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import WorkspaceProvider, { useWorkspace } from '@/components/WorkspaceProvider'
import Sidebar from '@/components/Sidebar'
import Onboarding from '@/components/Onboarding'
import { Spinner } from '@/components/ui'

function Shell({ children }) {
  const { teams, teamsLoaded, error } = useWorkspace()

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
      <Sidebar />
      <div className="main">{children}</div>
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
