'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { useChartTheme } from '@/components/ThemeProvider'
import LogHoursModal from '@/components/LogHoursModal'
import { Avatar, Empty, Spinner, StatCard } from '@/components/ui'
import { CHART_COLORS } from '@/lib/constants'
import { deleteTimeLog, logHours } from '@/lib/db'
import { formatDate, hours, hoursTrend, memberWorkload, summarise } from '@/lib/analytics'

const RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
]

export default function HoursPage() {
  const { user } = useAuth()
  const { teamId, tasks, timeLogs, members, loading, memberPhoto } = useWorkspace()
  const chart = useChartTheme()
  const [range, setRange] = useState('30')
  const [who, setWho] = useState('all')
  const [logging, setLogging] = useState(false)

  const scoped = useMemo(() => {
    let list = timeLogs
    if (range !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - Number(range))
      const key = cutoff.toISOString().slice(0, 10)
      list = list.filter((l) => l.date >= key)
    }
    if (who === 'me') list = list.filter((l) => l.userId === user.uid)
    else if (who !== 'all') list = list.filter((l) => l.userId === who)
    return list
  }, [timeLogs, range, who, user.uid])

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const stats = summarise(tasks, scoped)
  const trend = hoursTrend(scoped, range === '7' ? 7 : 30)
  const workload = memberWorkload(members, tasks, scoped).filter((m) => m.hours > 0)
  const myHours = timeLogs.filter((l) => l.userId === user.uid).reduce((s, l) => s + l.hours, 0)
  const totalScoped = scoped.reduce((s, l) => s + l.hours, 0)
  const avgPerDay = totalScoped / (range === 'all' ? Math.max(1, trend.length) : Number(range))

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Hours</h1>
          <div className="page-sub">Time logged by the team</div>
        </div>
        <button className="btn btn-primary" onClick={() => setLogging(true)}>◷ Log hours</button>
      </header>

      <div className="page">
        <div className="row wrap" style={{ gap: 10 }}>
          <select className="select" style={{ maxWidth: 180 }} value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 200 }} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">Whole team</option>
            <option value="me">Just me</option>
            {members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>)}
          </select>
        </div>

        <div className="grid grid-4">
          <StatCard label="Hours in range" value={hours(totalScoped)} hint={`${scoped.length} entries`} accent="var(--accent)" />
          <StatCard label="Average per day" value={hours(avgPerDay)} />
          <StatCard label="My total hours" value={hours(myHours)} hint="All time" />
          <StatCard label="Estimated remaining" value={hours(Math.max(0, stats.estimated - stats.totalHours))} hint={`${hours(stats.estimated)} estimated`} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Daily hours</div>
                <div className="card-sub">{RANGES.find((r) => r.id === range)?.label}</div>
              </div>
            </div>
            {scoped.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" {...chart.axis} tickLine={false} interval="preserveStartEnd" />
                  <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={chart.cursor}
                    contentStyle={chart.tooltip}
                    formatter={(v) => [hours(v), 'Hours']}
                  />
                  <Bar dataKey="hours" fill={chart.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No hours in this range" hint="Try a wider range, or log some time." />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Share by member</div>
                <div className="card-sub">Who logged what</div>
              </div>
            </div>
            {workload.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={workload} dataKey="hours" nameKey="name" innerRadius={56} outerRadius={90}
                    paddingAngle={3} stroke="none">
                    {workload.map((entry, i) => (
                      <Cell key={entry.uid} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chart.tooltip}
                    formatter={(v, n) => [hours(v), n]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="Nothing logged yet" />
            )}
          </section>
        </div>

        <section className="card" style={{ padding: '18px 6px' }}>
          <div className="card-head" style={{ padding: '0 12px' }}>
            <div>
              <div className="card-title">Time entries</div>
              <div className="card-sub">{scoped.length} entr{scoped.length === 1 ? 'y' : 'ies'}</div>
            </div>
          </div>
          {scoped.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Task</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'right' }}>Hours</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scoped.map((log) => (
                  <tr key={log.id}>
                    <td className="muted">{formatDate(log.date)}</td>
                    <td>
                      <div className="row">
                        <Avatar name={log.userName} seed={log.userId} src={memberPhoto(log.userId)} size="avatar-sm" />
                        <span className="small">{log.userName}</span>
                      </div>
                    </td>
                    <td>
                      {log.taskId ? (
                        <Link href={`/task?id=${log.taskId}`} className="link">{log.taskTitle}</Link>
                      ) : <span className="faint">General work</span>}
                    </td>
                    <td className="muted small">{log.note || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{hours(log.hours)}</td>
                    <td style={{ width: 40 }}>
                      {log.userId === user.uid ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => window.confirm('Delete this time entry?') && deleteTimeLog(teamId, log)}
                        >
                          ✕
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No time entries" hint="Log hours against a task to build the charts." />
          )}
        </section>
      </div>

      {logging ? (
        <LogHoursModal
          tasks={tasks}
          onClose={() => setLogging(false)}
          onSubmit={(data) => logHours(teamId, data, user)}
        />
      ) : null}
    </>
  )
}
