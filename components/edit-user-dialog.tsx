'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { COUNTRIES, getCountryName, getFlagEmoji } from '@/lib/countries'
import { formatDate } from '@/lib/utils/date'

const COUNTRY_NONE = '__none__'
const GENDER_EMPTY = '__'

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'tester', label: 'Tester' },
  { value: 'demo', label: 'Demo' },
]

/** Same shape as ManagedUser in users-manager - used to avoid circular dependency */
export interface UserDialogUser {
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

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create mode; set = edit mode */
  user: UserDialogUser | null
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const isCreate = user === null
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [profilePictureUrl, setProfilePictureUrl] = useState('')
  const [age, setAge] = useState('')
  const [countryCode, setCountryCode] = useState(COUNTRY_NONE)
  const [role, setRole] = useState('tester')
  const [gender, setGender] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [snapchatHandle, setSnapchatHandle] = useState('')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const countryDropdownRef = useRef<HTMLDivElement>(null)

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : COUNTRIES

  useEffect(() => {
    if (!countryOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [countryOpen])

  useEffect(() => {
    if (!open) return
    if (isCreate) {
      setEmail('')
      setName('')
      setUsername('')
      setProfilePictureUrl('')
      setAge('')
      setCountryCode(COUNTRY_NONE)
      setRole('tester')
      setGender('')
      setInstagramHandle('')
      setSnapchatHandle('')
      setPassword('')
    } else {
      setEmail(user!.email || '')
      setName(user!.name || '')
      setUsername(user!.username || '')
      setProfilePictureUrl(user!.profile_picture_url || '')
      setAge(user!.age != null ? String(user!.age) : '')
      setCountryCode(user!.country_code || COUNTRY_NONE)
      setRole(ROLE_OPTIONS.some((o) => o.value === user!.role) ? user!.role : ROLE_OPTIONS[0].value)
      setGender(
        user!.gender && ['male', 'female'].includes(user!.gender.toLowerCase())
          ? user!.gender.toLowerCase()
          : ''
      )
      setInstagramHandle(user!.instagram_handle || '')
      setSnapchatHandle(user!.snapchat_handle || '')
      setPassword('')
    }
  }, [open, isCreate, user])

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCreate || !user) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (e.g. JPG, PNG).',
        variant: 'destructive',
      })
      return
    }
    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('userId', user.id)
      const response = await fetch('/api/users/upload-profile-image', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      setProfilePictureUrl(data.profile_picture_url)
      toast({ title: 'Image uploaded', description: 'Profile picture uploaded successfully.' })
    } catch (err: unknown) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload image.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
      e.target.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email?.trim() || !role) return
    setIsSaving(true)
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          role,
          password: password.trim() || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create user')
      toast({
        title: 'User created',
        description: `User ${data.email} created with role ${ROLE_OPTIONS.find((o) => o.value === data.role)?.label ?? data.role}.`,
      })
      onOpenChange(false)
      setPassword('')
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: 'Creation failed',
        description: err instanceof Error ? err.message : 'An error occurred while creating the user.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSaving(true)
    const ageNum = age.trim() === '' ? null : parseInt(age.trim(), 10)
    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: email.trim() || null,
          name: name.trim() || null,
          username: username.trim() || null,
          profile_picture_url: profilePictureUrl.trim() || null,
          age: ageNum !== null && !Number.isNaN(ageNum) ? ageNum : null,
          country_code: countryCode && countryCode !== COUNTRY_NONE ? countryCode : null,
          gender: gender && gender !== '' ? gender : null,
          instagram_handle: instagramHandle.trim() || null,
          snapchat_handle: snapchatHandle.trim() || null,
          password: password.trim() || null,
          role: role || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update user')
      toast({ title: 'User updated', description: 'The user details have been updated successfully.' })
      onOpenChange(false)
      setPassword('')
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'An error occurred while updating the user.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formId = `user-dialog-${isCreate ? 'create' : user!.id}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-4 sm:p-5">
        <DialogHeader className="space-y-1 pb-3">
          <DialogTitle className="text-base">{isCreate ? 'Add user' : 'Edit user'}</DialogTitle>
          <DialogDescription className="text-xs">
            {isCreate ? 'Create a new user.' : 'Profile and auth details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={isCreate ? handleCreate : handleUpdate}>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            {/* Row: Avatar + Name/Username | Gender/Age — same for add and edit; avatar upload disabled in create */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageUpload}
                disabled={isUploadingImage || isCreate}
              />
              <button
                type="button"
                onClick={() => !isCreate && fileInputRef.current?.click()}
                disabled={isUploadingImage || isCreate}
                className="relative h-[62px] w-[62px] shrink-0 rounded-full ring-offset-2 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isCreate ? undefined : 'Upload photo'}
              >
                <Avatar className="h-full w-full cursor-pointer border-2 border-transparent hover:border-gray-300 transition-colors">
                  {profilePictureUrl ? (
                    <AvatarImage src={profilePictureUrl} alt="Profile" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {(name || username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isUploadingImage && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-white">
                    …
                  </span>
                )}
              </button>
              <div className="grid flex-1 grid-cols-2 gap-2 min-w-0">
                <div className="space-y-1.5">
                  <Input
                    id={`name-${formId}`}
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-7 text-sm"
                  />
                  <Input
                    id={`username-${formId}`}
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-7 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Select
                    value={gender === '' ? GENDER_EMPTY : gender}
                    onValueChange={(v) => setGender(v === GENDER_EMPTY ? '' : v)}
                  >
                    <SelectTrigger id={`gender-${formId}`} className="h-7 text-sm">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENDER_EMPTY}>—</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id={`age-${formId}`}
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="h-7 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1 relative" ref={countryDropdownRef}>
              <Label htmlFor={`country-code-${formId}`} className="text-xs">Country</Label>
              <Button
                id={`country-code-${formId}`}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={countryOpen}
                className="h-8 w-full justify-between font-normal text-sm border-gray-300 px-2"
                onClick={() => {
                  setCountryOpen((prev) => !prev)
                  if (!countryOpen) setCountrySearch('')
                }}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {countryCode && countryCode !== COUNTRY_NONE ? (
                    <>
                      <span>{getFlagEmoji(countryCode)}</span>
                      <span className="truncate">{getCountryName(countryCode)}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
              {countryOpen && (
                <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded border border-gray-200 bg-white shadow-lg">
                  <div className="border-b border-gray-100 p-1.5">
                    <Input
                      placeholder="Search..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[260px] overflow-y-auto p-1">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100"
                      onClick={() => { setCountryCode(COUNTRY_NONE); setCountryOpen(false) }}
                    >
                      — No country
                    </button>
                    {filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100"
                        onClick={() => { setCountryCode(c.code); setCountryOpen(false) }}
                      >
                        <span>{getFlagEmoji(c.code)}</span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <div className="py-4 text-center text-xs text-gray-500">No country found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`instagram-${formId}`} className="text-xs">Instagram</Label>
                <Input
                  id={`instagram-${formId}`}
                  type="text"
                  placeholder="@username"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`snapchat-${formId}`} className="text-xs">Snapchat</Label>
                <Input
                  id={`snapchat-${formId}`}
                  type="text"
                  placeholder="Username"
                  value={snapchatHandle}
                  onChange={(e) => setSnapchatHandle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`role-${formId}`} className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id={`role-${formId}`} className="h-8 text-sm">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`email-${formId}`} className="text-xs">Email</Label>
                <Input
                  id={`email-${formId}`}
                  type="email"
                  required={isCreate}
                  placeholder={isCreate ? 'user@example.com' : 'Keep current'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`password-${formId}`} className="text-xs">Password</Label>
                <Input
                  id={`password-${formId}`}
                  type="text"
                  placeholder={isCreate ? 'Leave empty to auto-generate' : 'Keep current'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {!isCreate && user && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-gray-500">
                <span>Connections: <span className="font-medium text-gray-700">{user.connection_count}</span></span>
                {user.created_at && (
                  <span>Created: {formatDate(user.created_at)}{user.created_at.includes('T') && ` ${new Date(user.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</span>
                )}
                {user.updated_at && (
                  <span>Updated: {formatDate(user.updated_at)}{user.updated_at.includes('T') && ` ${new Date(user.updated_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</span>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-3 sm:pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (isCreate ? 'Creating...' : 'Saving...') : isCreate ? 'Create user' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
