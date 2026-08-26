'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useWorkspace } from './WorkspaceProvider'
import { Avatar } from './ui'
import { ThemeToggle } from './ThemeProvider'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◧' },
  { href: '/tasks', label: 'Tasks', icon: '☑' },
  { href: '/hours', label: 'Hours', icon: '◷' },
  { href: '/team', label: 'Team', icon: '☺' },
  { href: '/profile', label: 'My Profile', icon: '☻' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { teams, teamId, setActiveTeamId } = useWorkspace()

  return (
    <aside className="sidebar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo.svg" alt="Market Neurons" width={34} height={34} />
        <div>
          <div className="brand-name">Market Neurons</div>
          <div className="brand-sub">Task workspace</div>
        </div>
      </div>

      {teams.length > 1 ? (
        <select className="select" value={teamId || ''} onChange={(e) => setActiveTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ) : null}

      <nav className="nav">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname.startsWith(link.href) ? 'active' : ''}`}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Link href="/profile" className="nav-link" style={{ padding: '8px 6px' }} title="Edit your profile">
          <Avatar
            name={user?.displayName || user?.email}
            seed={user?.uid}
            src={user?.photoURL}
            size="avatar-sm"
          />
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
              {user?.displayName || 'Member'}
            </div>
            <div className="faint" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
        </Link>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" style={{ flex: 1 }} onClick={signOut}>Sign out</button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
