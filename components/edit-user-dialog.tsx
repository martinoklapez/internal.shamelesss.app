'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface EditUserDialogProps {
  userId: string
  initialName: string | null
  initialUsername: string | null
  initialEmail: string | null
  initialProfilePictureUrl: string | null
  initialAge: number | null
  initialCountryCode: string | null
  initialGender: string | null
  initialInstagramHandle: string | null
  initialSnapchatHandle: string | null
  initialConnectionCount: number
  initialCreatedAt: string | null
  initialUpdatedAt: string | null
  initialRole: string
}

export function EditUserDialog({
  userId,
  initialName,
  initialUsername,
  initialEmail,
  initialProfilePictureUrl,
  initialAge,
  initialCountryCode,
  initialGender,
  initialInstagramHandle,
  initialSnapchatHandle,
  initialConnectionCount,
  initialCreatedAt,
  initialUpdatedAt,
  initialRole,
}: EditUserDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(initialEmail || '')
  const [name, setName] = useState(initialName || '')
  const [username, setUsername] = useState(initialUsername || '')
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialProfilePictureUrl || '')
  const [age, setAge] = useState(initialAge != null ? String(initialAge) : '')
  const [countryCode, setCountryCode] = useState(initialCountryCode || COUNTRY_NONE)
  const [role, setRole] = useState(ROLE_OPTIONS.some((o) => o.value === initialRole) ? initialRole : ROLE_OPTIONS[0].value)
  const [gender, setGender] = useState(
    initialGender && ['male', 'female'].includes(initialGender.toLowerCase())
      ? initialGender.toLowerCase()
      : ''
  )
  const [instagramHandle, setInstagramHandle] = useState(initialInstagramHandle || '')
  const [snapchatHandle, setSnapchatHandle] = useState(initialSnapchatHandle || '')
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

  // Close country dropdown when clicking outside
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

  // Sync form state when dialog opens with latest props
  useEffect(() => {
    if (open) {
      setEmail(initialEmail || '')
      setName(initialName || '')
      setUsername(initialUsername || '')
      setProfilePictureUrl(initialProfilePictureUrl || '')
      setAge(initialAge != null ? String(initialAge) : '')
      setCountryCode(initialCountryCode || COUNTRY_NONE)
      setGender(
        initialGender && ['male', 'female'].includes(initialGender.toLowerCase())
          ? initialGender.toLowerCase()
          : ''
      )
      setInstagramHandle(initialInstagramHandle || '')
      setSnapchatHandle(initialSnapchatHandle || '')
      setPassword('')
      setRole(ROLE_OPTIONS.some((o) => o.value === initialRole) ? initialRole : ROLE_OPTIONS[0].value)
    }
  }, [
    open,
    initialRole,
    initialEmail,
    initialName,
    initialUsername,
    initialProfilePictureUrl,
    initialAge,
    initialCountryCode,
    initialGender,
    initialInstagramHandle,
    initialSnapchatHandle,
  ])

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      formData.set('userId', userId)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const ageNum = age.trim() === '' ? null : parseInt(age.trim(), 10)

    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      toast({
        title: 'User updated',
        description: 'The user details have been updated successfully.',
      })

      setOpen(false)
      setPassword('')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast({
        title: 'Update failed',
        description: error.message || 'An error occurred while updating the user.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Edit user</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 p-4 sm:p-5">
        <DialogHeader className="space-y-1 pb-3">
          <DialogTitle className="text-base">Edit User</DialogTitle>
          <DialogDescription className="text-xs">
            Profile and auth details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            {/* Row: Avatar + (Name, Username stacked) | (Gender, Age stacked) */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageUpload}
                disabled={isUploadingImage}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="relative h-[62px] w-[62px] shrink-0 rounded-full ring-offset-2 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Upload photo"
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
                    id={`name-${userId}`}
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-7 text-sm"
                  />
                  <Input
                    id={`username-${userId}`}
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
                    <SelectTrigger id={`gender-${userId}`} className="h-7 text-sm">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENDER_EMPTY}>—</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id={`age-${userId}`}
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

            {/* Row: Country */}
            <div className="space-y-1 relative" ref={countryDropdownRef}>
                <Label htmlFor={`country-code-${userId}`} className="text-xs">Country</Label>
                <Button
                  id={`country-code-${userId}`}
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

            {/* Row: Instagram, Snapchat */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`instagram-${userId}`} className="text-xs">Instagram</Label>
                <Input
                  id={`instagram-${userId}`}
                  type="text"
                  placeholder="@username"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`snapchat-${userId}`} className="text-xs">Snapchat</Label>
                <Input
                  id={`snapchat-${userId}`}
                  type="text"
                  placeholder="Username"
                  value={snapchatHandle}
                  onChange={(e) => setSnapchatHandle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Row: Role */}
            <div className="space-y-1">
              <Label htmlFor={`role-${userId}`} className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id={`role-${userId}`} className="h-8 text-sm">
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

            {/* Row: Email, Password */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`email-${userId}`} className="text-xs">Email</Label>
                <Input
                  id={`email-${userId}`}
                  type="email"
                  placeholder="Keep current"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`password-${userId}`} className="text-xs">Password</Label>
                <Input
                  id={`password-${userId}`}
                  type="text"
                  placeholder="Keep current"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Footer: connection count + timestamps inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-gray-500">
              <span>Connections: <span className="font-medium text-gray-700">{initialConnectionCount}</span></span>
              {initialCreatedAt && (
                <span>Created: {formatDate(initialCreatedAt)}{initialCreatedAt.includes('T') && ` ${new Date(initialCreatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</span>
              )}
              {initialUpdatedAt && (
                <span>Updated: {formatDate(initialUpdatedAt)}{initialUpdatedAt.includes('T') && ` ${new Date(initialUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</span>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-3 sm:pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


