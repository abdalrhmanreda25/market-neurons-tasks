'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile as updateAuthProfile,
} from 'firebase/auth'
import { auth, initAnalytics } from '@/lib/firebase'
import { claimPendingInvites, ensureUserDoc, subscribeUser } from '@/lib/db'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    initAnalytics()
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(fbUser)
      try {
        await ensureUserDoc(fbUser)
        await claimPendingInvites(fbUser)
      } catch (err) {
        console.error('[auth] profile bootstrap failed:', err.code, err.message)
        setAuthError(err)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return undefined
    return subscribeUser(user.uid, setProfile)
  }, [user])

  // Everything downstream only needs uid / email / displayName, and the
  // Firestore profile is the source of truth for the name the team sees.
  const identity = useMemo(() => {
    if (!user) return null
    return {
      uid: user.uid,
      email: user.email,
      displayName: profile?.displayName || user.displayName || (user.email || '').split('@')[0],
      photoURL: profile?.photoURL || user.photoURL || null,
    }
  }, [user, profile])

  const value = useMemo(
    () => ({
      user: identity,
      authUser: user,
      profile,
      loading,
      authError,
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateAuthProfile(cred.user, { displayName: name })
        await ensureUserDoc(cred.user, name)
        await claimPendingInvites(cred.user)
      },
      signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
      signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
      resetPassword: (email) => sendPasswordResetEmail(auth, email),
      signOut: () => signOut(auth),
      /** Firebase requires a fresh credential before a password change. */
      async changePassword(currentPassword, newPassword) {
        const current = auth.currentUser
        if (!current) throw new Error('You are signed out.')
        const providers = current.providerData.map((p) => p.providerId)
        if (!providers.includes('password')) {
          throw new Error('This account signs in with Google, so it has no password to change.')
        }
        const credential = EmailAuthProvider.credential(current.email, currentPassword)
        await reauthenticateWithCredential(current, credential)
        await updatePassword(current, newPassword)
      },
      hasPasswordLogin: () =>
        Boolean(auth.currentUser?.providerData?.some((p) => p.providerId === 'password')),
    }),
    [identity, user, profile, loading, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
