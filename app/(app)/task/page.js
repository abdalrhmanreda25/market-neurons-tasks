'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import TaskForm from '@/components/TaskForm'
import LogHoursModal from '@/components/LogHoursModal'
import { Avatar, Empty, PriorityBadge, Spinner, StatusBadge } from '@/components/ui'
import { STATUSES } from '@/lib/constants'
import {
  addComment,
  deleteComment,
  deleteTask,
  logHours,
  subscribeComments,
  subscribeTask,
  updateTask,
} from '@/lib/db'
import { formatDate, formatTimestamp, hours, isOverdue } from '@/lib/analytics'
import { friendlyError } from '@/lib/errors'

function TaskDetail() {
  const taskId = useSearchParams().get('id')
  const router = useRouter()
  const { user } = useAuth()
  const { teamId, members, timeLogs, canManage, memberName, memberPhoto, loading } = useWorkspace()

  const [task, setTask] = useState(undefined)
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!teamId || !taskId) return undefined
    return subscribeTask(teamId, taskId, setTask)
  }, [teamId, taskId])

  useEffect(() => {
    if (!teamId || !taskId) return undefined
    return subscribeComments(teamId, taskId, setComments)
  }, [teamId, taskId])

  const taskLogs = useMemo(
    () => timeLogs.filter((l) => l.taskId === taskId),
    [timeLogs, taskId]
  )

  if (loading || task === undefined) return <div style={{ padding: 60 }}><Spinner /></div>

  if (task === null) {
    return (
      <div className="page">
        <Empty
          title="Task not found"
          hint="It may have been deleted."
          action={<Link href="/tasks" className="btn">Back to tasks</Link>}
        />
      </div>
    )
  }

  const canEdit = canManage || task.createdBy === user.uid || task.assigneeId === user.uid
  const progress = task.estimateHours
    ? Math.min(100, Math.round(((task.loggedHours || 0) / task.estimateHours) * 100))
    : 0

  const post = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setPosting(true)
    setError('')
    try {
      await addComment(teamId, taskId, draft, user)
      setDraft('')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setPosting(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${task.title}"? Its comments and time logs go with it.`)) return
    await deleteTask(teamId, taskId)
    router.push('/tasks')
  }

  return (
    <>
      <header className="topbar">
        <div className="row">
          <Link href="/tasks" className="btn btn-ghost btn-sm">← Tasks</Link>
          <div>
            <h1 className="page-title" style={{ fontSize: 17 }}>{task.title}</h1>
            <div className="page-sub">Created by {task.createdByName || 'someone'} · {formatTimestamp(task.createdAt)}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setLogging(true)}>◷ Log hours</button>
          {canEdit ? <button className="btn" onClick={() => setEditing(true)}>Edit</button> : null}
          {canEdit ? <button className="btn btn-danger" onClick={remove}>Delete</button> : null}
        </div>
      </header>

      <div className="page">
        <div className="grid grid-split" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card">
              <div className="card-head">
                <div className="card-title">Description</div>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: task.description ? 'var(--text)' : 'var(--faint)', whiteSpace: 'pre-wrap' }}>
                {task.description || 'No description yet.'}
              </p>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Comments</div>
                  <div className="card-sub">{comments.length} message{comments.length === 1 ? '' : 's'}</div>
                </div>
              </div>

              <form onSubmit={post} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
                <textarea
                  className="textarea"
                  style={{ minHeight: 74 }}
                  placeholder="Leave a comment for the team…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(e)
                  }}
                />
                {error ? <div className="alert alert-error">{error}</div> : null}
                <div className="between">
                  <span className="faint small">⌘ + Enter to send</span>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={posting || !draft.trim()}>
                    {posting ? 'Posting…' : 'Comment'}
                  </button>
                </div>
              </form>

              <div>
                {comments.map((c) => (
                  <div className="comment" key={c.id}>
                    <Avatar name={c.authorName} seed={c.authorId} src={memberPhoto(c.authorId)} size="avatar-sm" />
                    <div className="comment-body">
                      <div className="comment-head">
                        <span className="comment-author">{c.authorName}</span>
                        <span className="faint" style={{ fontSize: 11.5 }}>{formatTimestamp(c.createdAt)}</span>
                        {c.authorId === user.uid ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 'auto', padding: '2px 6px' }}
                            onClick={() => deleteComment(teamId, taskId, c.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                      <div className="comment-text">{c.text}</div>
                    </div>
                  </div>
                ))}
                {!comments.length ? <Empty title="No comments yet" hint="Start the conversation." /> : null}
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card">
              <div className="card-head"><div className="card-title">Details</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <span className="label">Status</span>
                  {canEdit ? (
                    <select
                      className="select"
                      value={task.status}
                      onChange={(e) => updateTask(teamId, taskId, { status: e.target.value })}
                    >
                      {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  ) : <StatusBadge status={task.status} />}
                </div>

                <div className="between">
                  <span className="label">Priority</span>
                  <PriorityBadge priority={task.priority} />
                </div>

                <div className="between">
                  <span className="label">Assignee</span>
                  {task.assigneeId ? (
                    <div className="row">
                      <Avatar name={memberName(task.assigneeId)} seed={task.assigneeId} src={memberPhoto(task.assigneeId)} size="avatar-sm" />
                      <span className="small">{memberName(task.assigneeId)}</span>
                    </div>
                  ) : <span className="faint small">Unassigned</span>}
                </div>

                <div className="between">
                  <span className="label">Due date</span>
                  <span className="small" style={{ color: isOverdue(task) ? 'var(--red)' : 'var(--text)' }}>
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div className="card-title">Time</div>
                <div className="card-sub">{hours(task.loggedHours)} of {hours(task.estimateHours)}</div>
              </div>
              <div className="progress" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    width: `${task.estimateHours ? progress : task.loggedHours ? 100 : 0}%`,
                    background: (task.loggedHours || 0) > (task.estimateHours || Infinity) ? 'var(--red)' : 'var(--accent)',
                  }}
                />
              </div>
              {taskLogs.length ? (
                <table className="table">
                  <tbody>
                    {taskLogs.slice(0, 8).map((log) => (
                      <tr key={log.id}>
                        <td style={{ padding: '8px 4px' }}>
                          <div className="small" style={{ fontWeight: 550 }}>{log.userName}</div>
                          <div className="faint" style={{ fontSize: 11 }}>{formatDate(log.date)}{log.note ? ` · ${log.note}` : ''}</div>
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{hours(log.hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="faint small" style={{ textAlign: 'center', padding: '10px 0' }}>No time logged yet.</div>
              )}
              <button className="btn btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => setLogging(true)}>
                + Log hours
              </button>
            </section>
          </div>
        </div>
      </div>

      {editing ? (
        <TaskForm
          initial={task}
          members={members}
          onClose={() => setEditing(false)}
          onSubmit={(data) => updateTask(teamId, taskId, data)}
        />
      ) : null}

      {logging ? (
        <LogHoursModal
          task={task}
          onClose={() => setLogging(false)}
          onSubmit={(data) => logHours(teamId, { ...data, taskId, taskTitle: task.title }, user)}
        />
      ) : null}
    </>
  )
}

export default function TaskPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60 }}><Spinner /></div>}>
      <TaskDetail />
    </Suspense>
  )
}
