/**
 * Task shape helpers.
 *
 * Tasks used to carry a single `assigneeId`; they now carry `assigneeIds`.
 * Documents written before the change are never rewritten in bulk, so every
 * read goes through these helpers rather than touching either field directly.
 * Editing a task writes the new field and drops the old one.
 */

export function taskAssignees(task) {
  if (!task) return []
  if (Array.isArray(task.assigneeIds)) return task.assigneeIds
  return task.assigneeId ? [task.assigneeId] : []
}

export function isAssignedTo(task, uid) {
  return Boolean(uid) && taskAssignees(task).includes(uid)
}

/** De-duplicates and drops empty ids so the stored array stays clean. */
export function cleanIds(ids) {
  return [...new Set((ids || []).filter(Boolean))]
}

/** Firestore Timestamp, Date, millis or ISO string -> Date (or null). */
export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
