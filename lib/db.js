'use client'

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_ROSTER } from './team-seed'
import { cleanIds } from './tasks'

/* ------------------------------------------------------------------ paths */

const usersCol = () => collection(db, 'users')
const userDoc = (uid) => doc(db, 'users', uid)
const teamsCol = () => collection(db, 'teams')
const teamDoc = (teamId) => doc(db, 'teams', teamId)
const tasksCol = (teamId) => collection(db, 'teams', teamId, 'tasks')
const taskDoc = (teamId, taskId) => doc(db, 'teams', teamId, 'tasks', taskId)
const commentsCol = (teamId, taskId) => collection(db, 'teams', teamId, 'tasks', taskId, 'comments')
const logsCol = (teamId) => collection(db, 'teams', teamId, 'timeLogs')
const invitesCol = () => collection(db, 'invites')
const codeDoc = (code) => doc(db, 'teamCodes', code)
const rosterDoc = () => doc(db, 'config', 'roster')
const sprintsCol = (teamId) => collection(db, 'teams', teamId, 'sprints')
const sprintDoc = (teamId, sprintId) => doc(db, 'teams', teamId, 'sprints', sprintId)
const notesCol = (teamId) => collection(db, 'teams', teamId, 'notes')
const noteDoc = (teamId, noteId) => doc(db, 'teams', teamId, 'notes', noteId)

const norm = (email) => (email || '').trim().toLowerCase()

/**
 * onSnapshot always with an error handler. Without one, a failed listener is
 * silent and every loading flag it feeds stays stuck.
 */
function listen(target, cb, onError) {
  return onSnapshot(target, cb, (err) => {
    console.error('[firestore] listener failed:', err.code, err.message)
    if (onError) onError(err)
  })
}

function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/* ------------------------------------------------------------------ users */

export async function ensureUserDoc(user, displayName) {
  const ref = userDoc(user.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const profile = {
      uid: user.uid,
      email: norm(user.email),
      photoURL: user.photoURL || null,
      displayName: displayName || user.displayName || (user.email || '').split('@')[0],
      teamIds: [],
      createdAt: serverTimestamp(),
    }
    await setDoc(ref, profile)
    return profile
  }

  // This runs on every auth state change, so it must not clobber anything the
  // user has edited. Only identity that Firebase owns is refreshed here.
  const stored = snap.data()
  const patch = { uid: user.uid, email: norm(user.email) }

  // An explicit name only arrives from sign-up; otherwise the stored one wins,
  // so a rename from the profile page survives the next sign-in.
  if (displayName) patch.displayName = displayName

  // Likewise the avatar: adopt the provider's picture only when the profile has
  // none, never in place of one the user uploaded.
  if (!stored.photoURL && user.photoURL) patch.photoURL = user.photoURL

  await updateDoc(ref, patch)
  return { ...stored, ...patch }
}

export function subscribeUser(uid, cb, onError) {
  return listen(userDoc(uid), (snap) => cb(snap.exists() ? snap.data() : null), onError)
}

export async function updateProfile(uid, data) {
  await updateDoc(userDoc(uid), data)
}

/** Mirrors a renamed profile into the member cache each team keeps. */
export async function syncMemberName(teamIds, uid, displayName) {
  return syncMemberProfile(teamIds, uid, { displayName })
}

/**
 * Copies the parts of a profile that teams cache on their member entry, so a
 * new name or photo shows up everywhere without a second lookup per member.
 */
export async function syncMemberProfile(teamIds, uid, { displayName, photoURL, title } = {}) {
  const patch = {}
  if (displayName !== undefined) patch[`members.${uid}.displayName`] = displayName
  if (photoURL !== undefined) patch[`members.${uid}.photoURL`] = photoURL
  if (title !== undefined) patch[`members.${uid}.title`] = title
  if (!Object.keys(patch).length) return
  await Promise.all(
    (teamIds || []).map((teamId) => updateDoc(teamDoc(teamId), patch).catch(() => {}))
  )
}

/* ------------------------------------------------------------------ teams */

export async function createTeam(user, name, roster) {
  const code = makeInviteCode()
  const ref = doc(teamsCol())
  const member = {
    role: 'owner',
    displayName: user.displayName || (user.email || '').split('@')[0],
    email: norm(user.email),
    joinedAt: Date.now(),
  }
  await setDoc(ref, {
    name: name.trim(),
    ownerId: user.uid,
    inviteCode: code,
    memberIds: [user.uid],
    members: { [user.uid]: member },
    createdAt: serverTimestamp(),
  })
  await setDoc(codeDoc(code), { teamId: ref.id, teamName: name.trim() })
  await updateDoc(userDoc(user.uid), { teamIds: arrayUnion(ref.id) })

  if (roster?.length) {
    await inviteRoster(
      { id: ref.id, name: name.trim(), members: { [user.uid]: member } },
      roster,
      user.uid
    )
  }
  return ref.id
}

export async function joinTeamByCode(user, code) {
  const clean = (code || '').trim().toUpperCase()
  if (!clean) throw new Error('Enter an invite code.')
  const snap = await getDoc(codeDoc(clean))
  if (!snap.exists()) throw new Error('That invite code does not match any team.')
  const { teamId } = snap.data()
  await joinTeam(user, teamId, 'member')
  return teamId
}

export async function joinTeam(user, teamId, role = 'member') {
  const member = {
    role,
    displayName: user.displayName || (user.email || '').split('@')[0],
    email: norm(user.email),
    joinedAt: Date.now(),
  }
  await updateDoc(teamDoc(teamId), {
    memberIds: arrayUnion(user.uid),
    [`members.${user.uid}`]: member,
  })
  await updateDoc(userDoc(user.uid), { teamIds: arrayUnion(teamId) })
}

export function subscribeMyTeams(uid, cb, onError) {
  const q = query(teamsCol(), where('memberIds', 'array-contains', uid))
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export function subscribeTeam(teamId, cb, onError) {
  return listen(teamDoc(teamId), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

export async function renameTeam(teamId, name) {
  await updateDoc(teamDoc(teamId), { name: name.trim() })
}

export async function setMemberRole(teamId, uid, role) {
  await updateDoc(teamDoc(teamId), { [`members.${uid}.role`]: role })
}

export async function removeMember(teamId, uid) {
  await updateDoc(teamDoc(teamId), {
    memberIds: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
  })
  await updateDoc(userDoc(uid), { teamIds: arrayRemove(teamId) }).catch(() => {})
}

/* ---------------------------------------------------------------- invites */

export async function inviteMember(team, email, role, invitedBy) {
  const target = norm(email)
  if (!target) throw new Error('Enter an email address.')
  if (Object.values(team.members || {}).some((m) => m.email === target)) {
    throw new Error('That person is already on the team.')
  }

  // If they already have an account, add them straight away.
  const existing = await getDocs(query(usersCol(), where('email', '==', target)))
  if (!existing.empty) {
    const profile = existing.docs[0].data()
    await updateDoc(teamDoc(team.id), {
      memberIds: arrayUnion(profile.uid),
      [`members.${profile.uid}`]: {
        role,
        displayName: profile.displayName || target.split('@')[0],
        email: target,
        joinedAt: Date.now(),
      },
    })
    await updateDoc(userDoc(profile.uid), { teamIds: arrayUnion(team.id) })
    return { added: true, email: target }
  }

  // Otherwise leave a pending invite they pick up on their first sign-in.
  await setDoc(doc(invitesCol(), `${team.id}_${target}`), {
    email: target,
    teamId: team.id,
    teamName: team.name,
    role,
    invitedBy,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return { added: false, email: target }
}

/* ----------------------------------------------------------------- roster */

/** The shared roster, stored in Firestore so it can change without a deploy. */
export function subscribeRoster(cb, onError) {
  return listen(rosterDoc(), (snap) => cb(snap.exists() ? snap.data().members || [] : []), onError)
}

export async function saveRoster(members) {
  const clean = members
    .map((m) => ({ email: norm(m.email), role: m.role === 'admin' ? 'admin' : 'member' }))
    .filter((m) => m.email)
  await setDoc(rosterDoc(), { members: clean, updatedAt: serverTimestamp() })
  return clean
}

/** Reads the roster, writing the bootstrap list the first time it is missing. */
export async function getRoster() {
  const snap = await getDoc(rosterDoc())
  const stored = snap.exists() ? snap.data().members : null
  if (stored?.length) return stored
  return saveRoster(DEFAULT_ROSTER)
}

/**
 * Invites a list of {email, role} entries one at a time, so one bad address
 * does not stop the rest. Returns a per-entry outcome.
 */
export async function inviteRoster(team, roster, invitedBy) {
  const results = []
  for (const entry of roster) {
    try {
      const outcome = await inviteMember(team, entry.email, entry.role, invitedBy)
      results.push({ ...outcome, role: entry.role, ok: true })
    } catch (err) {
      results.push({ email: entry.email, role: entry.role, ok: false, reason: err.message })
    }
  }
  return results
}

export function subscribeTeamInvites(teamId, cb, onError) {
  const q = query(invitesCol(), where('teamId', '==', teamId), where('status', '==', 'pending'))
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function cancelInvite(inviteId) {
  await deleteDoc(doc(invitesCol(), inviteId))
}

/** Accepts every pending invite addressed to this user's email. */
export async function claimPendingInvites(user) {
  const q = query(invitesCol(), where('email', '==', norm(user.email)), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  const joined = []
  for (const d of snap.docs) {
    const invite = d.data()
    await joinTeam(user, invite.teamId, invite.role || 'member')
    await deleteDoc(d.ref)
    joined.push(invite.teamId)
  }
  return joined
}

/* ------------------------------------------------------------------ tasks */

export function subscribeTasks(teamId, cb, onError) {
  const q = query(tasksCol(teamId), orderBy('createdAt', 'desc'))
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export function subscribeTask(teamId, taskId, cb, onError) {
  return listen(taskDoc(teamId, taskId), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

export async function createTask(teamId, data, user) {
  const status = data.status || 'todo'
  const ref = await addDoc(tasksCol(teamId), {
    title: data.title.trim(),
    description: data.description || '',
    status,
    priority: data.priority || 'medium',
    assigneeIds: cleanIds(data.assigneeIds),
    sprintId: data.sprintId || null,
    // Burndown needs to know when work finished, not just that it did.
    completedAt: status === 'done' ? serverTimestamp() : null,
    dueDate: data.dueDate || null,
    estimateHours: Number(data.estimateHours) || 0,
    loggedHours: 0,
    commentCount: 0,
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * `previous` is the task as the caller last saw it. It lets a status change
 * stamp `completedAt` only on a real transition, so re-saving a done task from
 * the edit form does not move its completion date to today.
 */
export async function updateTask(teamId, taskId, data, previous) {
  const patch = { ...data, updatedAt: serverTimestamp() }

  if (data.assigneeIds !== undefined) {
    patch.assigneeIds = cleanIds(data.assigneeIds)
    patch.assigneeId = deleteField() // migrate away from the single-assignee field
  }

  if (data.sprintId !== undefined) patch.sprintId = data.sprintId || null

  if (data.status !== undefined && (!previous || previous.status !== data.status)) {
    patch.completedAt = data.status === 'done' ? serverTimestamp() : null
  }

  await updateDoc(taskDoc(teamId, taskId), patch)
}

/** Moves many tasks in or out of a sprint in one atomic write. */
export async function assignTasksToSprint(teamId, taskIds, sprintId) {
  const ids = cleanIds(taskIds)
  if (!ids.length) return
  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach((id) =>
      batch.update(taskDoc(teamId, id), { sprintId: sprintId || null, updatedAt: serverTimestamp() })
    )
    await batch.commit()
  }
}

export async function deleteTask(teamId, taskId) {
  const batch = writeBatch(db)
  const comments = await getDocs(commentsCol(teamId, taskId))
  comments.forEach((d) => batch.delete(d.ref))
  const logs = await getDocs(query(logsCol(teamId), where('taskId', '==', taskId)))
  logs.forEach((d) => batch.delete(d.ref))
  batch.delete(taskDoc(teamId, taskId))
  await batch.commit()
}


/* ---------------------------------------------------------------- sprints */

export function subscribeSprints(teamId, cb, onError) {
  // Ordered client-side: a freshly created sprint has a pending server
  // timestamp, and ordering by it server-side would hide it for a moment.
  return listen(sprintsCol(teamId), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

function validateSprint({ name, startDate, endDate }) {
  if (!name || !name.trim()) throw new Error('Give the sprint a name.')
  if (!startDate || !endDate) throw new Error('A sprint needs a start and an end date.')
  if (endDate < startDate) throw new Error('The sprint cannot end before it starts.')
}

export async function createSprint(teamId, data, user) {
  validateSprint(data)
  const ref = await addDoc(sprintsCol(teamId), {
    name: data.name.trim(),
    goal: (data.goal || '').trim(),
    startDate: data.startDate,
    endDate: data.endDate,
    status: 'planned',
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
    stats: null,
  })
  return ref.id
}

export async function updateSprint(teamId, sprintId, data) {
  validateSprint(data)
  await updateDoc(sprintDoc(teamId, sprintId), {
    name: data.name.trim(),
    goal: (data.goal || '').trim(),
    startDate: data.startDate,
    endDate: data.endDate,
  })
}

/** Only one sprint may run at a time, which keeps "the current sprint" unambiguous. */
export async function startSprint(teamId, sprint, allSprints) {
  const running = allSprints.find((s) => s.status === 'active' && s.id !== sprint.id)
  if (running) throw new Error(`Complete "${running.name}" before starting another sprint.`)
  await updateDoc(sprintDoc(teamId, sprint.id), { status: 'active', startedAt: serverTimestamp() })
}

/**
 * Closes a sprint. Finished tasks stay attached, so its history survives;
 * unfinished ones move to `carryTo` (another sprint id) or back to the backlog.
 * A stats snapshot is stored because carried-over tasks leave the sprint, and
 * velocity should reflect what was committed at the time.
 */
export async function completeSprint(teamId, sprint, tasks, carryTo) {
  const inSprint = tasks.filter((t) => t.sprintId === sprint.id)
  const done = inSprint.filter((t) => t.status === 'done')
  const unfinished = inSprint.filter((t) => t.status !== 'done')

  const stats = {
    committed: inSprint.length,
    completed: done.length,
    carriedOver: unfinished.length,
    committedHours: inSprint.reduce((sum, t) => sum + (t.estimateHours || 0), 0),
    completedHours: done.reduce((sum, t) => sum + (t.estimateHours || 0), 0),
    loggedHours: inSprint.reduce((sum, t) => sum + (t.loggedHours || 0), 0),
  }

  const batch = writeBatch(db)
  batch.update(sprintDoc(teamId, sprint.id), {
    status: 'completed',
    completedAt: serverTimestamp(),
    carriedTo: carryTo || null,
    stats,
  })
  unfinished.forEach((t) =>
    batch.update(taskDoc(teamId, t.id), { sprintId: carryTo || null, updatedAt: serverTimestamp() })
  )
  await batch.commit()
  return stats
}

/** Deleting a sprint never deletes work: its tasks return to the backlog. */
export async function deleteSprint(teamId, sprint, tasks) {
  const batch = writeBatch(db)
  tasks
    .filter((t) => t.sprintId === sprint.id)
    .forEach((t) => batch.update(taskDoc(teamId, t.id), { sprintId: null, updatedAt: serverTimestamp() }))
  batch.delete(sprintDoc(teamId, sprint.id))
  await batch.commit()
}

/* --------------------------------------------------------------- comments */

export function subscribeComments(teamId, taskId, cb, onError) {
  const q = query(commentsCol(teamId, taskId), orderBy('createdAt', 'asc'))
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function addComment(teamId, taskId, text, user) {
  const body = text.trim()
  if (!body) return
  await addDoc(commentsCol(teamId, taskId), {
    text: body,
    authorId: user.uid,
    authorName: user.displayName || user.email,
    createdAt: serverTimestamp(),
  })
  await updateDoc(taskDoc(teamId, taskId), { commentCount: increment(1) })
}

export async function deleteComment(teamId, taskId, commentId) {
  await deleteDoc(doc(commentsCol(teamId, taskId), commentId))
  await updateDoc(taskDoc(teamId, taskId), { commentCount: increment(-1) })
}

/* ------------------------------------------------------ notes & guidelines */

export function subscribeNotes(teamId, cb, onError) {
  // Ordered client-side, for the same pending-timestamp reason as sprints.
  return listen(notesCol(teamId), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

function validateNote({ title, body }) {
  if (!title || !title.trim()) throw new Error('Give it a title.')
  if (!body || !body.trim()) throw new Error('Write something in the body.')
}

export async function createNote(teamId, data, user) {
  validateNote(data)
  const ref = await addDoc(notesCol(teamId), {
    kind: data.kind === 'guideline' ? 'guideline' : 'note',
    title: data.title.trim(),
    body: data.body.trim(),
    category: data.category || 'general',
    pinned: Boolean(data.pinned),
    ackBy: [],
    authorId: user.uid,
    authorName: user.displayName || user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateNote(teamId, noteId, data) {
  validateNote(data)
  await updateDoc(noteDoc(teamId, noteId), {
    title: data.title.trim(),
    body: data.body.trim(),
    category: data.category || 'general',
    pinned: Boolean(data.pinned),
    updatedAt: serverTimestamp(),
  })
}

export async function setNotePinned(teamId, noteId, pinned) {
  await updateDoc(noteDoc(teamId, noteId), { pinned: Boolean(pinned) })
}

/** A member confirms they have read a guideline, or takes that back. */
export async function acknowledgeNote(teamId, noteId, uid, read = true) {
  await updateDoc(noteDoc(teamId, noteId), { ackBy: read ? arrayUnion(uid) : arrayRemove(uid) })
}

export async function deleteNote(teamId, noteId) {
  await deleteDoc(noteDoc(teamId, noteId))
}

/* ------------------------------------------------------------------ hours */

export function subscribeTimeLogs(teamId, cb, onError) {
  const q = query(logsCol(teamId), orderBy('date', 'desc'))
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function logHours(teamId, { taskId, taskTitle, hours, date, note }, user) {
  const amount = Number(hours)
  if (!amount || amount <= 0) throw new Error('Hours must be greater than zero.')
  await addDoc(logsCol(teamId), {
    taskId: taskId || null,
    taskTitle: taskTitle || 'General work',
    hours: amount,
    date,
    note: note || '',
    userId: user.uid,
    userName: user.displayName || user.email,
    createdAt: serverTimestamp(),
  })
  if (taskId) await updateDoc(taskDoc(teamId, taskId), { loggedHours: increment(amount) })
}

export async function deleteTimeLog(teamId, log) {
  await deleteDoc(doc(logsCol(teamId), log.id))
  if (log.taskId) {
    await updateDoc(taskDoc(teamId, log.taskId), { loggedHours: increment(-log.hours) }).catch(() => {})
  }
}
