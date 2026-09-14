import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek, subDays } from 'date-fns'
import { PRIORITIES, STATUSES } from './constants'
import { isAssignedTo, toDate } from './tasks'

const today = () => format(new Date(), 'yyyy-MM-dd')

export function summarise(tasks, timeLogs) {
  const done = tasks.filter((t) => t.status === 'done').length
  const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length
  const overdue = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < today()
  ).length

  const totalHours = timeLogs.reduce((sum, l) => sum + (l.hours || 0), 0)
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekHours = timeLogs
    .filter((l) => l.date >= weekStart)
    .reduce((sum, l) => sum + (l.hours || 0), 0)

  const estimated = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  return {
    total: tasks.length,
    done,
    active,
    overdue,
    totalHours,
    weekHours,
    estimated,
    completion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  }
}

export function statusBreakdown(tasks) {
  return STATUSES.map((s) => ({
    name: s.label,
    value: tasks.filter((t) => t.status === s.id).length,
    color: s.color,
  }))
}

export function priorityBreakdown(tasks) {
  return PRIORITIES.map((p) => ({
    name: p.label,
    open: tasks.filter((t) => t.priority === p.id && t.status !== 'done').length,
    done: tasks.filter((t) => t.priority === p.id && t.status === 'done').length,
    color: p.color,
  }))
}

export function hoursTrend(timeLogs, days = 14) {
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDays(new Date(), i)
    const key = format(day, 'yyyy-MM-dd')
    buckets.push({
      key,
      name: format(day, 'MMM d'),
      hours: timeLogs.filter((l) => l.date === key).reduce((s, l) => s + (l.hours || 0), 0),
    })
  }
  return buckets
}

export function memberWorkload(members, tasks, timeLogs) {
  return members
    .map((m) => {
      const mine = tasks.filter((t) => isAssignedTo(t, m.uid))
      return {
        uid: m.uid,
        name: m.displayName || m.email,
        role: m.role,
        open: mine.filter((t) => t.status !== 'done').length,
        done: mine.filter((t) => t.status === 'done').length,
        total: mine.length,
        estimate: mine.reduce((s, t) => s + (t.estimateHours || 0), 0),
        hours: timeLogs.filter((l) => l.userId === m.uid).reduce((s, l) => s + (l.hours || 0), 0),
      }
    })
    .sort((a, b) => b.hours - a.hours)
}

export function hoursByTask(tasks, timeLogs, limit = 6) {
  const map = new Map()
  timeLogs.forEach((l) => {
    const key = l.taskId || 'general'
    const entry = map.get(key) || { name: l.taskTitle || 'General work', hours: 0 }
    entry.hours += l.hours || 0
    map.set(key, entry)
  })
  return [...map.values()]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit)
    .map((e) => ({ ...e, name: e.name.length > 24 ? `${e.name.slice(0, 23)}…` : e.name }))
}

export function isOverdue(task) {
  return task.status !== 'done' && task.dueDate && task.dueDate < today()
}

export function formatDate(value) {
  if (!value) return '—'
  try {
    return format(typeof value === 'string' ? parseISO(value) : value, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatTimestamp(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return format(date, "MMM d, yyyy 'at' h:mm a")
}

export const hours = (n) => `${Math.round((n || 0) * 10) / 10}h`

/* ---------------------------------------------------------------- sprints */

const dayKey = (date) => format(date, 'yyyy-MM-dd')

/** Active first, then planned soonest-first, then completed newest-first. */
export function sortSprints(sprints) {
  const rank = { active: 0, planned: 1, completed: 2 }
  return [...sprints].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    if (a.status === 'completed') return (b.endDate || '').localeCompare(a.endDate || '')
    return (a.startDate || '').localeCompare(b.startDate || '')
  })
}

export function sprintTasks(tasks, sprintId) {
  return tasks.filter((t) => (sprintId ? t.sprintId === sprintId : !t.sprintId))
}

/** When a finished task finished. Older tasks predate completedAt, so fall back. */
function completedOn(task) {
  if (task.status !== 'done') return null
  return toDate(task.completedAt) || toDate(task.updatedAt) || new Date()
}

export function sprintDays(sprint) {
  if (!sprint?.startDate || !sprint?.endDate) return { total: 0, elapsed: 0, left: 0 }
  const start = parseISO(sprint.startDate)
  const end = parseISO(sprint.endDate)
  const today = new Date()
  const total = differenceInCalendarDays(end, start) + 1
  const elapsed = Math.min(total, Math.max(0, differenceInCalendarDays(today, start) + 1))
  const left = Math.max(0, differenceInCalendarDays(end, today))
  return { total, elapsed, left }
}

export function sprintSummary(sprint, tasks, timeLogs) {
  const items = sprintTasks(tasks, sprint.id)
  const ids = new Set(items.map((t) => t.id))
  const done = items.filter((t) => t.status === 'done')
  const estimate = items.reduce((sum, t) => sum + (t.estimateHours || 0), 0)
  const doneEstimate = done.reduce((sum, t) => sum + (t.estimateHours || 0), 0)
  return {
    items,
    total: items.length,
    done: done.length,
    open: items.length - done.length,
    inProgress: items.filter((t) => t.status === 'in_progress' || t.status === 'review').length,
    estimate,
    remainingHours: Math.max(0, estimate - doneEstimate),
    logged: timeLogs.filter((l) => ids.has(l.taskId)).reduce((sum, l) => sum + (l.hours || 0), 0),
    completion: items.length ? Math.round((done.length / items.length) * 100) : 0,
    days: sprintDays(sprint),
  }
}

/**
 * Remaining work at the end of each sprint day, against an ideal straight line.
 * `mode` is 'tasks' (count) or 'hours' (estimated hours). Days that have not
 * happened yet have no actual value, so the line stops at today.
 */
export function burndown(sprint, tasks, mode = 'tasks') {
  if (!sprint?.startDate || !sprint?.endDate) return []
  const items = sprintTasks(tasks, sprint.id)
  const weight = (t) => (mode === 'hours' ? t.estimateHours || 0 : 1)
  const total = items.reduce((sum, t) => sum + weight(t), 0)

  const start = parseISO(sprint.startDate)
  const days = differenceInCalendarDays(parseISO(sprint.endDate), start) + 1
  const todayKey = dayKey(new Date())

  const finished = items.map((t) => ({ w: weight(t), on: completedOn(t) }))

  return Array.from({ length: Math.max(days, 1) }, (_, i) => {
    const day = addDays(start, i)
    const key = dayKey(day)
    const burned = finished
      .filter((f) => f.on && dayKey(f.on) <= key)
      .reduce((sum, f) => sum + f.w, 0)
    const ideal = days > 1 ? total - (total * i) / (days - 1) : 0
    return {
      name: format(day, 'MMM d'),
      ideal: Math.round(ideal * 10) / 10,
      remaining: key <= todayKey ? Math.round((total - burned) * 10) / 10 : null,
    }
  })
}

/** Committed vs completed across finished sprints, oldest first. */
export function velocity(sprints, tasks) {
  return sprints
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
    .map((s) => {
      const fallback = sprintTasks(tasks, s.id)
      const completed = s.stats?.completed ?? fallback.filter((t) => t.status === 'done').length
      const committed = s.stats?.committed ?? fallback.length
      return { name: s.name, committed, completed }
    })
}
