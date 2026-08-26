'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Firebase web configuration.
 *
 * These values are public by design - they are compiled into the client bundle
 * and visible to anyone who opens the site. Security comes from the Firestore
 * rules and the Authorized Domains list, not from keeping them secret.
 *
 * The defaults are baked in on purpose: prerendering constructs Auth at build
 * time, so a host that does not pick up a .env file would otherwise fail the
 * whole build with auth/invalid-api-key. Setting the matching
 * NEXT_PUBLIC_FIREBASE_* variables still overrides any of them.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDEAUW087oys93F5PAB9BeIqlfGtqqu7LQ',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'secretcomms-6de0e.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'secretcomms-6de0e',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'secretcomms-6de0e.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '49266914884',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:49266914884:web:950b363ccaa6d715392e11',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-4Q97LP257N',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// Analytics is browser-only and fails in unsupported environments, so it is
// loaded lazily and never blocks the rest of the app.
export function initAnalytics() {
  if (typeof window === 'undefined') return
  import('firebase/analytics')
    .then(({ isSupported, getAnalytics }) =>
      isSupported().then((ok) => {
        if (ok) getAnalytics(app)
      })
    )
    .catch(() => {})
}

export default app
