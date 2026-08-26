'use client'

import Link from 'next/link'
import {
  Area,
  AreaChart,
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
import { useWorkspace } from '@/components/WorkspaceProvider'
import { useChartTheme } from '@/components/ThemeProvider'
import { Avatar, Empty, Spinner, StatCard, StatusBadge } from '@/components/ui'
import {
  formatDate,
  hours,
  hoursByTask,
  hoursTrend,
  isOverdue,
  memberWorkload,
  priorityBreakdown,
  statusBreakdown,
  summarise,
} from '@/lib/analytics'


export default function DashboardPage() {
  const { team, tasks, timeLogs, members, loading, memberPhoto } = useWorkspace()
  const chart = useChartTheme()

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const stats = summarise(tasks, timeLogs)
  const statusData = statusBreakdown(tasks).filter((s) => s.value > 0)
  const priorityData = priorityBreakdown(tasks)
  const trend = hoursTrend(timeLogs, 14)
  const workload = memberWorkload(members, tasks, timeLogs)
  const taskHours = hoursByTask(tasks, timeLogs)

  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-sub">{team?.name} · {members.length} member{members.length === 1 ? '' : 's'}</div>
        </div>
        <Link href="/tasks" className="btn btn-primary">Open board</Link>
      </header>

      <div className="page">
        <div className="grid grid-4">
          <StatCard label="Total tasks" value={stats.total} hint={`${stats.active} in flight`} />
          <StatCard label="Completed" value={`${stats.completion}%`} hint={`${stats.done} of ${stats.total} done`} accent="var(--green)" />
          <StatCard label="Hours logged" value={hours(stats.totalHours)} hint={`${hours(stats.weekHours)} this week`} accent="var(--accent)" />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            hint={stats.overdue ? 'Needs attention' : 'Everything on schedule'}
            accent={stats.overdue ? 'var(--red)' : undefined}
          />
        </div>

        <div className="grid grid-split">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Hours logged</div>
                <div className="card-sub">Last 14 days across the team</div>
              </div>
              <div className="card-sub">{hours(trend.reduce((s, d) => s + d.hours, 0))} total</div>
            </div>
            {timeLogs.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.accent} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={chart.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" {...chart.axis} tickLine={false} />
                  <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={chart.tooltip}
                    formatter={(v) => [hours(v), 'Hours']}
                  />
                  <Area type="monotone" dataKey="hours" stroke={chart.accent} strokeWidth={2} fill="url(#hoursFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No hours logged yet" hint="Log time from the Hours page or a task." />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Task status</div>
                <div className="card-sub">Where work sits right now</div>
              </div>
            </div>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chart.tooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No tasks yet" hint="Create your first task to see the split." />
            )}
          </section>
        </div>

        <div className="grid grid-2">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Hours by member</div>
                <div className="card-sub">Who is putting in the time</div>
              </div>
            </div>
            {workload.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={workload} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" {...chart.axis} tickLine={false} interval={0} />
                  <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={chart.cursor}
                    contentStyle={chart.tooltip}
                    formatter={(v, n) => [n === 'hours' ? hours(v) : v, n === 'hours' ? 'Logged' : 'Estimated']}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                  <Bar dataKey="estimate" name="Estimated" fill={chart.track} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hours" name="Logged" fill={chart.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No members yet" />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Tasks by priority</div>
                <div className="card-sub">Open vs completed</div>
              </div>
            </div>
            {tasks.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" {...chart.axis} tickLine={false} />
                  <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={chart.cursor}
                    contentStyle={chart.tooltip}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="#f5a623" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="done" name="Done" stackId="a" fill="#14ae5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No tasks yet" />
            )}
          </section>
        </div>

        <div className="grid grid-2">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Top tasks by hours</div>
                <div className="card-sub">Where the effort is going</div>
              </div>
            </div>
            {taskHours.length ? (
              <ResponsiveContainer width="100%" height={Math.max(180, taskHours.length * 40)}>
                <BarChart data={taskHours} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} horizontal={false} />
                  <XAxis type="number" {...chart.axis} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} {...chart.axis} tickLine={false} />
                  <Tooltip
                    cursor={chart.cursor}
                    contentStyle={chart.tooltip}
                    formatter={(v) => [hours(v), 'Logged']}
                  />
                  <Bar dataKey="hours" fill={chart.accent} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty title="No time logged against tasks yet" />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Upcoming deadlines</div>
                <div className="card-sub">Next tasks due</div>
              </div>
              <Link href="/tasks" className="btn btn-ghost btn-sm">View all</Link>
            </div>
            {upcoming.length ? (
              <table className="table">
                <tbody>
                  {upcoming.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/task?id=${task.id}`} className="link">{task.title}</Link>
                      </td>
                      <td style={{ width: 120 }}><StatusBadge status={task.status} /></td>
                      <td style={{ width: 130, color: isOverdue(task) ? 'var(--red)' : 'var(--muted)' }}>
                        {formatDate(task.dueDate)}
                      </td>
                      <td style={{ width: 40 }}>
                        {task.assigneeId ? (
                          <Avatar
                            name={members.find((m) => m.uid === task.assigneeId)?.displayName}
                            seed={task.assigneeId}
                            src={memberPhoto(task.assigneeId)}
                            size="avatar-sm"
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="Nothing scheduled" hint="Add due dates to tasks to see them here." />
            )}
          </section>
        </div>
      </div>
    </>
  )
}
