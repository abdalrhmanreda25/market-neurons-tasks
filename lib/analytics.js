import { format, parseISO, startOfWeek, subDays } from 'date-fns'
import { PRIORITIES, STATUSES } from './constants'

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
      const mine = tasks.filter((t) => t.assigneeId === m.uid)
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
