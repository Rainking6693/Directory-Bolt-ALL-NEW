import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to pricing page
    router.replace('/pricing')
  }, [router])

  return (
    <>
      <Head>
        <title>Sign Up - DirectoryBolt</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting...</p>
      </div>
    </>
  )
}
