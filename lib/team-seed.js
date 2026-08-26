// Bootstrap roster. This is only the seed: once written it lives in Firestore
// at config/roster, and the Team page edits it there.
export const DEFAULT_ROSTER = [
  { email: 'codex@marketneurons.com', role: 'admin' },
  { email: 'hesham@marketneurons.com', role: 'admin' },
  { email: 'abdo@marketneurons.com', role: 'member' },
  { email: 'taha@marketneurons.com', role: 'member' },
  { email: 'ragh@marketneurons.com', role: 'member' },
  { email: 'mohamed@marketneurons.com', role: 'member' },
]

/** Splits the roster into who has joined, who is invited, and who is missing. */
export function rosterStatus(roster, team, invites = []) {
  const joined = new Map(
    Object.entries(team?.members || {}).map(([uid, m]) => [(m.email || '').toLowerCase(), { uid, ...m }])
  )
  const pending = new Set(invites.map((i) => (i.email || '').toLowerCase()))
  return (roster || []).map((entry) => {
    const email = entry.email.toLowerCase()
    if (joined.has(email)) return { ...entry, state: 'joined', member: joined.get(email) }
    if (pending.has(email)) return { ...entry, state: 'invited' }
    return { ...entry, state: 'missing' }
  })
}
