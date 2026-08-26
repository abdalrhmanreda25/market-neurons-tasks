const MESSAGES = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already uses that email.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console.',
  'permission-denied': 'You do not have permission to do that.',
}

export function friendlyError(err) {
  if (!err) return 'Something went wrong.'
  return MESSAGES[err.code] || err.message || 'Something went wrong.'
}
