'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui'

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    // Public signup is disabled; accounts are provisioned and added by administrators
    router.replace('/login')
  }, [router])

  return <Spinner full />
}
