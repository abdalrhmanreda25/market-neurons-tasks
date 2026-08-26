'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthProvider'
import { subscribeMyTeams, subscribeTasks, subscribeTeam, subscribeTimeLogs } from '@/lib/db'

const WorkspaceContext = createContext(null)
const STORAGE_KEY = 'mn.activeTeam'

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

export default function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [team, setTeam] = useState(null)
  const [tasks, setTasks] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setTeams([])
      setTeamsLoaded(false)
      return undefined
    }
    return subscribeMyTeams(
      user.uid,
      (list) => {
        setTeams(list)
        setTeamsLoaded(true)
        setError(null)
      },
      (err) => {
        setError(err)
        setTeamsLoaded(true)
      }
    )
  }, [user])

  // Keep the selected team valid as membership changes.
  useEffect(() => {
    if (!teamsLoaded) return
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const valid = teams.some((t) => t.id === activeTeamId)
    if (valid) return
    const next = teams.find((t) => t.id === stored)?.id || teams[0]?.id || null
    setActiveTeamId(next)
  }, [teams, teamsLoaded, activeTeamId])

  useEffect(() => {
    if (activeTeamId && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, activeTeamId)
    }
  }, [activeTeamId])

  useEffect(() => {
    if (!activeTeamId) {
      setTeam(null)
      setTasks([])
      setTimeLogs([])
      setDataLoaded(teamsLoaded)
      return undefined
    }
    setDataLoaded(false)
    let seen = 0
    const done = () => {
      seen += 1
      if (seen >= 3) setDataLoaded(true)
    }
    // A failed listener counts as settled too, otherwise the page spins forever.
    const failed = (err) => {
      setError(err)
      setDataLoaded(true)
    }
    const unsubs = [
      subscribeTeam(activeTeamId, (t) => {
        setTeam(t)
        done()
      }, failed),
      subscribeTasks(activeTeamId, (t) => {
        setTasks(t)
        done()
      }, failed),
      subscribeTimeLogs(activeTeamId, (l) => {
        setTimeLogs(l)
        done()
      }, failed),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [activeTeamId, teamsLoaded])

  const members = useMemo(() => {
    if (!team?.members) return []
    return Object.entries(team.members)
      .map(([uid, m]) => ({ uid, ...m }))
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }, [team])

  const myRole = team?.members?.[user?.uid]?.role || 'member'

  const value = useMemo(
    () => ({
      teams,
      teamsLoaded,
      error,
      team,
      teamId: activeTeamId,
      setActiveTeamId,
      tasks,
      timeLogs,
      members,
      myRole,
      canManage: myRole === 'owner' || myRole === 'admin',
      loading: !teamsLoaded || (Boolean(activeTeamId) && !dataLoaded),
      memberName: (uid) => team?.members?.[uid]?.displayName || 'Unassigned',
      memberPhoto: (uid) => team?.members?.[uid]?.photoURL || null,
      memberTitle: (uid) => team?.members?.[uid]?.title || '',
    }),
    [teams, teamsLoaded, team, activeTeamId, tasks, timeLogs, members, myRole, dataLoaded, error]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
