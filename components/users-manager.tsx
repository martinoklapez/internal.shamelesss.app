'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserDialog } from '@/components/edit-user-dialog'

type ManagedUser = {
  id: string
  name: string | null
  username: string | null
  role: string
  profile_picture_url: string | null
  age: number | null
  country_code: string | null
  gender: string | null
  instagram_handle: string | null
  snapchat_handle: string | null
  connection_count: number
  created_at: string | null
  updated_at: string | null
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
  demo: 'Demo',
}

const ALL_ROLES_VALUE = '__all__'

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: ALL_ROLES_VALUE, label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'tester', label: 'Tester' },
  { value: 'demo', label: 'Demo' },
]

export default function UsersManager({ initialUsers }: UsersManagerProps) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers)
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES_VALUE)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogUser, setDialogUser] = useState<ManagedUser | null>(null)

  // Refresh users list when component receives new props
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  const filteredUsers = useMemo(() => {
    if (roleFilter === ALL_ROLES_VALUE) return users
    return users.filter((u) => u.role === roleFilter)
  }, [users, roleFilter])

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 shrink-0">Users</h2>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">
            {filteredUsers.length === users.length
              ? `${users.length} total`
              : `${filteredUsers.length} of ${users.length}`}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => {
              setDialogUser(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add user</span>
          </Button>
        </div>
      </div>
      <UserDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setDialogUser(null)
        }}
        user={dialogUser}
      />
      <div className="divide-y divide-gray-100">
        {filteredUsers.length === 0 ? (
          <div className="px-6 py-6 text-sm text-gray-500">
            {users.length === 0 ? 'No users found.' : 'No users match the selected role.'}
          </div>
        ) : (
          filteredUsers.map((user) => {
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                    onClick={() => {
                      setDialogUser(user)
                      setDialogOpen(true)
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Edit user</span>
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

