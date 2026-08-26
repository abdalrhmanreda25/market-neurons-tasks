export const STATUSES = [
  { id: 'todo', label: 'To Do', color: '#9a9aa2' },
  { id: 'in_progress', label: 'In Progress', color: '#f5a623' },
  { id: 'review', label: 'In Review', color: '#f4511e' },
  { id: 'done', label: 'Done', color: '#14ae5c' },
]

export const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#9a9aa2' },
  { id: 'medium', label: 'Medium', color: '#fbc7a6' },
  { id: 'high', label: 'High', color: '#f5a623' },
  { id: 'urgent', label: 'Urgent', color: '#f4511e' },
]

export const ROLES = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Member' },
]

export const statusMeta = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0]
export const priorityMeta = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1]

export const CHART_COLORS = ['#f4511e', '#f5a623', '#fbc7a6', '#14ae5c', '#5b8def', '#7c5cff', '#e5322d', '#9a9aa2']
