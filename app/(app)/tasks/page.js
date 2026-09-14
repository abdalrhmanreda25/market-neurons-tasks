'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import TaskForm from '@/components/TaskForm'
import { AvatarStack, Empty, PriorityBadge, Spinner, StatusBadge } from '@/components/ui'
import { STATUSES, priorityMeta } from '@/lib/constants'
import { createTask, updateTask } from '@/lib/db'
import { formatDate, hours, isOverdue } from '@/lib/analytics'
import { isAssignedTo, taskAssignees } from '@/lib/tasks'

function TasksBoard() {
  const { user } = useAuth()
  const { teamId, tasks, members, sprints, activeSprint, sprintName, loading, memberName, memberPhoto } = useWorkspace()
  const router = useRouter()
  const params = useSearchParams()

  const [view, setView] = useState('board')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [priority, setPriority] = useState('all')
  // ?sprint=<id> | active | backlog, so the sprints page can deep-link a board.
  const [sprint, setSprint] = useState(params.get('sprint') || 'all')
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (q && !`${t.title} ${t.description || ''}`.toLowerCase().includes(q)) return false
      if (assignee === 'me' && !isAssignedTo(t, user.uid)) return false
      if (assignee === 'none' && taskAssignees(t).length) return false
      if (!['all', 'me', 'none'].includes(assignee) && !isAssignedTo(t, assignee)) return false
      if (priority !== 'all' && t.priority !== priority) return false
      if (sprint === 'backlog' && t.sprintId) return false
      if (sprint === 'active' && (!activeSprint || t.sprintId !== activeSprint.id)) return false
      if (!['all', 'backlog', 'active'].includes(sprint) && t.sprintId !== sprint) return false
      return true
    })
  }, [tasks, search, assignee, priority, sprint, activeSprint, user.uid])

  // New tasks land in whichever sprint the board is currently showing.
  const defaultSprintId =
    sprint === 'active' ? activeSprint?.id || null : ['all', 'backlog'].includes(sprint) ? null : sprint

  const onDrop = async (statusId) => {
    setDragOver(null)
    const task = tasks.find((t) => t.id === dragId)
    setDragId(null)
    if (!task || task.status === statusId) return
    await updateTask(teamId, task.id, { status: statusId }, task)
  }

  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="page-sub">{filtered.length} of {tasks.length} shown</div>
        </div>
        <div className="row">
          <div className="row" style={{ gap: 4, background: 'var(--panel-2)', padding: 3, borderRadius: 9 }}>
            {['board', 'list'].map((v) => (
              <button
                key={v}
                className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setView(v)}
                style={{ textTransform: 'capitalize' }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New task</button>
        </div>
      </header>

      <div className="page">
        <div className="row wrap" style={{ gap: 10 }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="select" style={{ maxWidth: 190 }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="all">Everyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
            ))}
          </select>
          <select className="select" style={{ maxWidth: 160 }} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="select" style={{ maxWidth: 220 }} value={sprint} onChange={(e) => setSprint(e.target.value)}>
            <option value="all">All sprints</option>
            {activeSprint ? <option value="active">Active: {activeSprint.name}</option> : null}
            <option value="backlog">Backlog</option>
            {sprints.filter((sp) => sp.status !== 'active').map((sp) => (
              <option key={sp.id} value={sp.id}>{sp.name}{sp.status === 'completed' ? ' (completed)' : ''}</option>
            ))}
          </select>
          {(search || assignee !== 'all' || priority !== 'all' || sprint !== 'all') ? (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setAssignee('all'); setPriority('all'); setSprint('all') }}>
              Clear filters
            </button>
          ) : null}
        </div>

        {!tasks.length ? (
          <div className="card">
            <Empty
              title="No tasks yet"
              hint="Create the first task and it will show up on the board and in your charts."
              action={<button className="btn btn-primary" onClick={() => setCreating(true)}>+ New task</button>}
            />
          </div>
        ) : view === 'board' ? (
          <div className="board">
            {STATUSES.map((col) => {
              const items = filtered.filter((t) => t.status === col.id)
              return (
                <div
                  key={col.id}
                  className={`column ${dragOver === col.id ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver((c) => (c === col.id ? null : c))}
                  onDrop={() => onDrop(col.id)}
                >
                  <div className="column-head">
                    <span className="dot" style={{ background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                    <span className="column-count">{items.length}</span>
                  </div>

                  {items.map((task) => (
                    <div
                      key={task.id}
                      className="task-card"
                      draggable
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null) }}
                      onClick={() => router.push(`/task?id=${task.id}`)}
                    >
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="task-card-title" style={{ flex: 1 }}>{task.title}</div>
                        <span
                          className="dot"
                          style={{ background: priorityMeta(task.priority).color, marginTop: 5 }}
                          title={priorityMeta(task.priority).label}
                        />
                      </div>

                      {sprint === 'all' && task.sprintId && sprintName(task.sprintId) ? (
                        <span className="sprint-tag">⟳ {sprintName(task.sprintId)}</span>
                      ) : null}

                      {task.estimateHours ? (
                        <div className="progress">
                          <span
                            style={{
                              width: `${Math.min(100, ((task.loggedHours || 0) / task.estimateHours) * 100)}%`,
                              background: (task.loggedHours || 0) > task.estimateHours ? 'var(--red)' : 'var(--accent)',
                            }}
                          />
                        </div>
                      ) : null}

                      <div className="task-meta">
                        <AvatarStack uids={taskAssignees(task)} nameOf={memberName} photoOf={memberPhoto} />
                        <span className="spacer" />
                        {task.commentCount ? <span>💬 {task.commentCount}</span> : null}
                        {task.estimateHours || task.loggedHours ? (
                          <span>{hours(task.loggedHours)} / {hours(task.estimateHours)}</span>
                        ) : null}
                        {task.dueDate ? (
                          <span style={{ color: isOverdue(task) ? 'var(--red)' : undefined }}>
                            {formatDate(task.dueDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {!items.length ? (
                    <div className="faint small" style={{ textAlign: 'center', padding: '18px 0' }}>
                      Drop tasks here
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card" style={{ padding: '18px 6px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignees</th>
                  <th>Sprint</th>
                  <th>Due</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/task?id=${task.id}`} className="link">{task.title}</Link>
                      {task.commentCount ? <span className="faint small"> · 💬 {task.commentCount}</span> : null}
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td><PriorityBadge priority={task.priority} /></td>
                    <td>
                      <AvatarStack uids={taskAssignees(task)} nameOf={memberName} photoOf={memberPhoto} showNames />
                    </td>
                    <td className="muted small">{task.sprintId ? sprintName(task.sprintId) || '—' : 'Backlog'}</td>
                    <td style={{ color: isOverdue(task) ? 'var(--red)' : 'var(--muted)' }}>
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="muted">{hours(task.loggedHours)} / {hours(task.estimateHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <Empty title="No tasks match those filters" /> : null}
          </div>
        )}
      </div>

      {creating ? (
        <TaskForm
          members={members}
          sprints={sprints}
          defaultSprintId={defaultSprintId}
          onClose={() => setCreating(false)}
          onSubmit={(data) => createTask(teamId, data, user)}
        />
      ) : null}
    </>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60 }}><Spinner /></div>}>
      <TasksBoard />
    </Suspense>
  )
}
