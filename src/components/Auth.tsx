'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function AuthUI() {
  const supabase = createClientComponentClient()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Welcome to OnDeck</h1>
          <p className="mt-2 text-gray-600">Please sign in to continue</p>
        </div>
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb', // blue-600
                    brandAccent: '#1d4ed8', // blue-700
                  },
                },
              },
            }}
            providers={['github', 'google']}
            theme="light"
          />
        </div>
      </div>
    </div>
  )
}