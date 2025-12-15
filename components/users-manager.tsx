'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EditUserDialog } from '@/components/edit-user-dialog'

type ManagedUser = {
  id: string
  name: string | null
  role: string
  profile_picture_url: string | null
  email: string | null
}

interface UsersManagerProps {
  initialUsers: ManagedUser[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
  promoter: 'Promoter',
  tester: 'Tester',
}

export default function UsersManager({ initialUsers }: UsersManagerProps) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers)

  // Refresh users list when component receives new props
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Users</h2>
        <span className="text-xs text-gray-500">{users.length} total</span>
      </div>
      <div className="divide-y divide-gray-100">
        {users.length === 0 ? (
          <div className="px-6 py-6 text-sm text-gray-500">No users found.</div>
        ) : (
          users.map((user) => {
            const initial =
              (user.name && user.name.trim().charAt(0).toUpperCase()) || 'U'

            return (
              <div
                key={user.id}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {user.profile_picture_url ? (
                      <AvatarImage
                        src={user.profile_picture_url}
                        alt={user.name || 'User'}
                      />
                    ) : (
                      <AvatarFallback>{initial}</AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.name || 'Unknown user'}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-600 break-all">
                        {user.email}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 break-all">
                      {user.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-medium text-gray-700 px-2 py-1 rounded-full bg-gray-100">
                    {ROLE_LABELS[user.role] || user.role}
                  </div>
                  <EditUserDialog
                    userId={user.id}
                    initialName={user.name}
                    initialEmail={user.email}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

