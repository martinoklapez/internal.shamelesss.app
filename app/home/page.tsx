import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gamepad2, Flag, Smartphone, ArrowRight } from 'lucide-react'
import { getUserRole } from '@/lib/user-roles'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  
  // Only allow admin, dev, developer, and promoter roles
  const allowedRoles = ['admin', 'dev', 'developer', 'promoter']
  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Shamelesss
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your games, devices, and feature flags
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(userRole === 'admin' || userRole === 'dev' || userRole === 'developer') && (
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-gray-600" />
                  <CardTitle>Games</CardTitle>
                </div>
                <CardDescription>
                  Manage game categories and content
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href="/games">
                  <Button variant="outline" className="w-full">
                    Go to Games
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-gray-600" />
                <CardTitle>Devices & Accounts</CardTitle>
              </div>
              <CardDescription>
                Manage devices, iCloud profiles, and social accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href="/devices">
                <Button variant="outline" className="w-full">
                  Go to Devices
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {(userRole === 'admin' || userRole === 'dev' || userRole === 'developer') && (
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-gray-600" />
                  <CardTitle>Feature Flags</CardTitle>
                </div>
                <CardDescription>
                  Control feature toggles and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href="/feature-flags">
                  <Button variant="outline" className="w-full">
                    Go to Feature Flags
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

