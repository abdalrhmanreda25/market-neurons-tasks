'use client'

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

/*
 * Infrastructure vault, per team:
 *   teams/{teamId}/vaultMeta/key   { salt, iterations, check{iv,ct}, createdBy, createdAt }
 *   teams/{teamId}/vault/{id}      { label, env, ref, iv, ct, createdBy, updatedBy, updatedAt }
 *
 * Only `iv`/`ct` hold secrets, and they are encrypted in the browser
 * (lib/vaultCrypto.js) before they get here. label/env/ref are plain so the
 * locked page can still show what exists. Rules restrict both to managers.
 */

const metaDoc = (teamId) => doc(db, 'teams', teamId, 'vaultMeta', 'key')
const entriesCol = (teamId) => collection(db, 'teams', teamId, 'vault')
const entryDoc = (teamId, id) => doc(db, 'teams', teamId, 'vault', id)

export function subscribeVaultMeta(teamId, onData, onError) {
  return onSnapshot(metaDoc(teamId), (snap) => onData(snap.exists() ? snap.data() : null), onError)
}

export function subscribeVaultEntries(teamId, onData, onError) {
  return onSnapshot(
    query(entriesCol(teamId), orderBy('label')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createVaultMeta(teamId, { salt, iterations, check }, uid) {
  await setDoc(metaDoc(teamId), { salt, iterations, check, createdBy: uid, createdAt: serverTimestamp() })
}

export async function addVaultEntry(teamId, { label, env, ref, sealed }, uid) {
  await addDoc(entriesCol(teamId), {
    label,
    env,
    ref: ref || null,
    iv: sealed.iv,
    ct: sealed.ct,
    createdBy: uid,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  })
}

export async function updateVaultEntry(teamId, id, { label, env, ref, sealed }, uid) {
  await updateDoc(entryDoc(teamId, id), {
    label,
    env,
    ref: ref || null,
    iv: sealed.iv,
    ct: sealed.ct,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteVaultEntry(teamId, id) {
  await deleteDoc(entryDoc(teamId, id))
}
