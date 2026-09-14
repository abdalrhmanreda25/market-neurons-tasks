'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { useChartTheme } from '@/components/ThemeProvider'
import { AvatarStack, Empty, Spinner, StatusBadge } from '@/components/ui'
import { AddTasksModal, CompleteSprintModal, SprintForm } from '@/components/SprintModals'
import { sprintStatusMeta } from '@/lib/constants'
import {
  assignTasksToSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  startSprint,
  updateSprint,
} from '@/lib/db'
import { burndown, formatDate, hours, sprintSummary, sprintTasks, velocity } from '@/lib/analytics'
import { isAssignedTo, taskAssignees } from '@/lib/tasks'
import { friendlyError } from '@/lib/errors'

export default function SprintsPage() {
  const { user } = useAuth()
  const { teamId, tasks, timeLogs, sprints, activeSprint, members, canManage, memberName, memberPhoto, loading } =
    useWorkspace()
  const chart = useChartTheme()

  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('tasks')
  const [modal, setModal] = useState(null) // { type, sprint }
  const [toast, setToast] = useState(null)

  // Keep a valid selection: prefer the running sprint, then the next planned one.
  useEffect(() => {
    if (sprints.some((s) => s.id === selectedId)) return
    setSelectedId(activeSprint?.id || sprints[0]?.id || null)
  }, [sprints, activeSprint, selectedId])

  const selected = sprints.find((s) => s.id === selectedId) || null
  const backlog = useMemo(() => sprintTasks(tasks, null).filter((t) => t.status !== 'done'), [tasks])
  const velocityData = useMemo(() => velocity(sprints, tasks), [sprints, tasks])

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  const flash = (ok, text) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 4000)
  }
  const run = async (fn, message) => {
    try {
      await fn()
      if (message) flash(true, message)
    } catch (err) {
      flash(false, friendlyError(err))
    }
  }

  const nextNumber = sprints.length + 1
  // Plan the next sprint to begin the day after the latest one ends.
  const lastEnd = sprints.map((s) => s.endDate).filter(Boolean).sort().pop()
  const suggestedStart = lastEnd && lastEnd >= format(new Date(), 'yyyy-MM-dd')
    ? format(addDays(parseISO(lastEnd), 1), 'yyyy-MM-dd')
    : undefined

  const planned = sprints.filter((s) => s.status === 'planned')
  const completed = sprints.filter((s) => s.status === 'completed')

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Sprints</h1>
          <div className="page-sub">
            {sprints.length} sprint{sprints.length === 1 ? '' : 's'} · {backlog.length} open task{backlog.length === 1 ? '' : 's'} in the backlog
          </div>
        </div>
        <div className="row">
          <Link href="/tasks?sprint=backlog" className="btn">Backlog</Link>
          {canManage ? (
            <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>+ New sprint</button>
          ) : null}
        </div>
      </header>

      <div className="page">
        {toast ? <div className={`alert ${toast.ok ? 'alert-ok' : 'alert-error'}`}>{toast.text}</div> : null}

        {!sprints.length ? (
          <div className="card">
            <Empty
              title="No sprints yet"
              hint={canManage
                ? 'Plan a sprint, pull tasks in from the backlog, then start it to track progress with a burndown chart.'
                : 'An owner or admin plans sprints. Once one starts, its progress shows up here.'}
              action={canManage ? (
                <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>Plan the first sprint</button>
              ) : null}
            />
          </div>
        ) : (
          <div className="grid grid-split" style={{ alignItems: 'start' }}>
            {/* ------------------------------------------------ selected sprint */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {selected ? (
                <SprintDetail
                  sprint={selected}
                  tasks={tasks}
                  timeLogs={timeLogs}
                  members={members}
                  userId={user.uid}
                  canManage={canManage}
                  hasActive={Boolean(activeSprint)}
                  chart={chart}
                  mode={mode}
                  setMode={setMode}
                  memberName={memberName}
                  memberPhoto={memberPhoto}
                  onStart={() => run(() => startSprint(teamId, selected, sprints), `${selected.name} started.`)}
                  onComplete={() => setModal({ type: 'complete', sprint: selected })}
                  onEdit={() => setModal({ type: 'edit', sprint: selected })}
                  onAdd={() => setModal({ type: 'add', sprint: selected })}
                  onRemoveTask={(task) => run(() => assignTasksToSprint(teamId, [task.id], null), `Moved "${task.title}" to the backlog.`)}
                  onDelete={() => {
                    const count = sprintTasks(tasks, selected.id).length
                    const warn = count ? ` Its ${count} task${count === 1 ? '' : 's'} will return to the backlog.` : ''
                    if (window.confirm(`Delete ${selected.name}?${warn}`)) {
                      run(() => deleteSprint(teamId, selected, tasks), `${selected.name} deleted.`)
                    }
                  }}
                />
              ) : null}
            </div>

            {/* ----------------------------------------------------- sprint list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <SprintList title="Active" sprints={activeSprint ? [activeSprint] : []} tasks={tasks} timeLogs={timeLogs}
                selectedId={selectedId} onSelect={setSelectedId} empty="No sprint running" />
              <SprintList title="Planned" sprints={planned} tasks={tasks} timeLogs={timeLogs}
                selectedId={selectedId} onSelect={setSelectedId} empty="Nothing planned" />
              <SprintList title="Completed" sprints={completed} tasks={tasks} timeLogs={timeLogs}
                selectedId={selectedId} onSelect={setSelectedId} empty="No finished sprints yet" />

              {velocityData.length ? (
                <section className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Velocity</div>
                      <div className="card-sub">Tasks committed vs completed per sprint</div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={velocityData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="name" {...chart.axis} tickLine={false} />
                      <YAxis {...chart.axis} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={chart.legend} />
                      <Bar dataKey="committed" name="Committed" fill={chart.track} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill={chart.accent} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'create' ? (
        <SprintForm
          suggestedName={`Sprint ${nextNumber}`}
          suggestedStart={suggestedStart}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            const id = await createSprint(teamId, data, user)
            setSelectedId(id)
            flash(true, `${data.name} planned. Add tasks from the backlog, then start it.`)
          }}
        />
      ) : null}

      {modal?.type === 'edit' ? (
        <SprintForm
          initial={modal.sprint}
          onClose={() => setModal(null)}
          onSubmit={(data) => updateSprint(teamId, modal.sprint.id, data)}
        />
      ) : null}

      {modal?.type === 'complete' ? (
        <CompleteSprintModal
          sprint={modal.sprint}
          summary={sprintSummary(modal.sprint, tasks, timeLogs)}
          plannedSprints={planned}
          onClose={() => setModal(null)}
          onConfirm={async (carryTo) => {
            const stats = await completeSprint(teamId, modal.sprint, tasks, carryTo)
            const where = carryTo ? sprints.find((s) => s.id === carryTo)?.name : 'the backlog'
            flash(true, stats.carriedOver
              ? `${modal.sprint.name} completed. ${stats.carriedOver} unfinished task${stats.carriedOver === 1 ? '' : 's'} moved to ${where}.`
              : `${modal.sprint.name} completed — everything was done.`)
          }}
        />
      ) : null}

      {modal?.type === 'add' ? (
        <AddTasksModal
          sprint={modal.sprint}
          backlog={backlog}
          onClose={() => setModal(null)}
          onConfirm={async (ids) => {
            await assignTasksToSprint(teamId, ids, modal.sprint.id)
            flash(true, `Added ${ids.length} task${ids.length === 1 ? '' : 's'} to ${modal.sprint.name}.`)
          }}
        />
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ detail */

function SprintDetail({
  sprint, tasks, timeLogs, members, userId, canManage, hasActive, chart, mode, setMode,
  memberName, memberPhoto, onStart, onComplete, onEdit, onAdd, onRemoveTask, onDelete,
}) {
  const sum = sprintSummary(sprint, tasks, timeLogs)
  const chartData = burndown(sprint, tasks, mode)
  const meta = sprintStatusMeta(sprint.status)
  const isCompleted = sprint.status === 'completed'
  const stats = sprint.stats

  const load = members
    .map((m) => {
      const mine = sum.items.filter((t) => isAssignedTo(t, m.uid))
      return { ...m, open: mine.filter((t) => t.status !== 'done').length, done: mine.filter((t) => t.status === 'done').length }
    })
    .filter((m) => m.open + m.done > 0)
    .sort((a, b) => b.open - a.open)

  const mineOpen = sum.items.filter((t) => t.status !== 'done' && isAssignedTo(t, userId)).length

  return (
    <>
      <section className="card">
        <div className="between wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <span className="badge" style={{ background: `${meta.color}1f`, color: meta.color }}>
              <span className="dot" style={{ background: meta.color }} /> {meta.label}
            </span>
            <h2 style={{ fontSize: 22, marginTop: 10 }}>{sprint.name}</h2>
            <div className="muted small" style={{ marginTop: 4 }}>
              {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)} · {sum.days.total} days
              {sprint.status === 'active' ? ` · ${sum.days.left} left` : ''}
            </div>
            {sprint.goal ? <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.6 }}>{sprint.goal}</p> : null}
          </div>

          <div className="row wrap" style={{ gap: 8 }}>
            <Link href={`/tasks?sprint=${sprint.id}`} className="btn btn-sm">Board</Link>
            {canManage && !isCompleted ? <button className="btn btn-sm" onClick={onAdd}>+ Add tasks</button> : null}
            {canManage && !isCompleted ? <button className="btn btn-sm" onClick={onEdit}>Edit</button> : null}
            {canManage && sprint.status === 'planned' ? (
              <button className="btn btn-sm btn-primary" onClick={onStart} disabled={hasActive}
                title={hasActive ? 'Complete the active sprint first' : undefined}>
                Start sprint
              </button>
            ) : null}
            {canManage && sprint.status === 'active' ? (
              <button className="btn btn-sm btn-accent" onClick={onComplete}>Complete sprint</button>
            ) : null}
            {canManage && !isCompleted ? <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button> : null}
          </div>
        </div>

        {canManage && sprint.status === 'planned' && hasActive ? (
          <div className="faint small" style={{ marginTop: 10 }}>Another sprint is running — complete it before starting this one.</div>
        ) : null}

        <div className="grid grid-4" style={{ marginTop: 18, gap: 12 }}>
          <Tile label="Progress" value={`${sum.completion}%`} hint={`${sum.done} of ${sum.total} done`} />
          <Tile label={isCompleted ? 'Carried over' : 'Open'} value={isCompleted ? stats?.carriedOver ?? 0 : sum.open}
            hint={isCompleted ? `of ${stats?.committed ?? sum.total} committed` : `${sum.inProgress} in progress`} />
          <Tile label="Remaining" value={hours(sum.remainingHours)} hint={`${hours(sum.estimate)} estimated`} />
          <Tile label="Logged" value={hours(isCompleted ? stats?.loggedHours ?? sum.logged : sum.logged)}
            hint={mineOpen ? `${mineOpen} open task${mineOpen === 1 ? '' : 's'} on you` : 'on sprint tasks'} />
        </div>

        <div className="progress" style={{ marginTop: 16 }}>
          <span style={{ width: `${sum.completion}%`, background: isCompleted ? 'var(--green)' : 'var(--accent)' }} />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Burndown</div>
            <div className="card-sub">
              {mode === 'hours' ? 'Estimated hours' : 'Tasks'} remaining each day, against the ideal pace
            </div>
          </div>
          <div className="segmented">
            {['tasks', 'hours'].map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m === 'tasks' ? 'Tasks' : 'Hours'}
              </button>
            ))}
          </div>
        </div>
        {sum.total ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="name" {...chart.axis} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...chart.axis} tickLine={false} allowDecimals={mode === 'hours'} />
              <Tooltip contentStyle={chart.tooltip}
                formatter={(v, n) => [v === null ? '—' : mode === 'hours' ? hours(v) : v, n]} />
              <Legend iconType="plainline" wrapperStyle={chart.legend} />
              <Line type="linear" dataKey="ideal" name="Ideal" stroke={chart.muted} strokeDasharray="5 5"
                strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="remaining" name="Remaining" stroke={chart.accent} strokeWidth={2.5}
                dot={{ r: 2.5 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty title="No tasks in this sprint yet"
            hint={canManage && !isCompleted ? 'Pull work in from the backlog to see the burndown.' : undefined}
            action={canManage && !isCompleted ? <button className="btn btn-sm" onClick={onAdd}>+ Add tasks</button> : null} />
        )}
      </section>

      <section className="card" style={{ padding: '18px 6px' }}>
        <div className="card-head" style={{ padding: '0 12px' }}>
          <div>
            <div className="card-title">Sprint backlog</div>
            <div className="card-sub">{sum.total} task{sum.total === 1 ? '' : 's'} committed</div>
          </div>
        </div>
        {sum.items.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Assignees</th>
                <th style={{ textAlign: 'right' }}>Estimate</th>
                {canManage && !isCompleted ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {[...sum.items]
                .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
                .map((task) => (
                  <tr key={task.id}>
                    <td style={{ maxWidth: 280 }}>
                      <Link href={`/task?id=${task.id}`} className="link"
                        style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                        {task.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td><AvatarStack uids={taskAssignees(task)} nameOf={memberName} photoOf={memberPhoto} /></td>
                    <td className="muted" style={{ textAlign: 'right' }}>{hours(task.estimateHours)}</td>
                    {canManage && !isCompleted ? (
                      <td style={{ width: 44 }}>
                        <button className="btn btn-ghost btn-sm" title="Move back to the backlog" onClick={() => onRemoveTask(task)}>✕</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Nothing committed yet" />
        )}
      </section>

      {load.length ? (
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Who is on what</div>
              <div className="card-sub">A shared task counts for each assignee</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {load.map((m) => {
              const total = m.open + m.done
              return (
                <div key={m.uid}>
                  <div className="between small" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{m.displayName || m.email}</span>
                    <span className="muted">{m.done}/{total} done · {m.open} open</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(m.done / total) * 100}%`, background: 'var(--green)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}

function Tile({ label, value, hint }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 24 }}>{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------- list */

function SprintList({ title, sprints, tasks, timeLogs, selectedId, onSelect, empty }) {
  return (
    <section className="card">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div className="card-title">{title}</div>
        <span className="column-count" style={{ marginLeft: 0 }}>{sprints.length}</span>
      </div>
      {sprints.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sprints.map((s) => {
            const sum = sprintSummary(s, tasks, timeLogs)
            const meta = sprintStatusMeta(s.status)
            return (
              <button key={s.id} type="button" className={`sprint-item ${s.id === selectedId ? 'selected' : ''}`}
                onClick={() => onSelect(s.id)}>
                <div className="between" style={{ gap: 8 }}>
                  <span className="sprint-item-name">{s.name}</span>
                  <span className="small muted">{sum.done}/{sum.total}</span>
                </div>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {formatDate(s.startDate)} → {formatDate(s.endDate)}
                  {s.status === 'active' ? ` · ${sum.days.left}d left` : ''}
                </div>
                <div className="progress" style={{ marginTop: 8, height: 5 }}>
                  <span style={{ width: `${sum.completion}%`, background: meta.color }} />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="faint small">{empty}</div>
      )}
    </section>
  )
}
