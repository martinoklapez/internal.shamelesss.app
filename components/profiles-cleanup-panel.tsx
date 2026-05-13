'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Trash2, RefreshCw, Download, Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
  promoter: 'Promoter',
  tester: 'Tester',
  demo: 'Demo',
  user: 'User',
}

function roleBadgeClassName(role: string) {
  if (role === 'admin') {
    return 'border-amber-400/80 bg-gradient-to-b from-amber-100 to-amber-200/90 text-amber-950 shadow-sm'
  }
  if (role === 'promoter') {
    return 'border-blue-400/70 bg-blue-100 text-blue-900'
  }
  return ''
}

export type CleanupProfileRow = {
  user_id: string
  role: string | null
  name: string | null
  username: string | null
  profile_picture_url: string | null
  age: number | null
  country_code: string | null
  gender: string | null
  instagram_handle: string | null
  snapchat_handle: string | null
  connection_count: number | null
  created_at: string | null
  updated_at: string | null
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProfilesCleanupPanel() {
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<CleanupProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [demoOnlyList, setDemoOnlyList] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exportDeleteOpen, setExportDeleteOpen] = useState(false)
  const [allowDeleteStaff, setAllowDeleteStaff] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = demoOnlyList ? '?demo_only=true' : ''
      const res = await fetch(`/api/profiles-cleanup/list${q}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load profiles')
      }
      setProfiles(data.profiles || [])
      setSelected(new Set())
    } catch (e) {
      toast({
        title: 'Could not load profiles',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, demoOnlyList])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => {
      const hay = [
        p.user_id,
        p.name ?? '',
        p.username ?? '',
        p.role ?? '',
        p.country_code ?? '',
        p.gender ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [profiles, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.user_id))

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const p of filtered) next.delete(p.user_id)
      } else {
        for (const p of filtered) next.add(p.user_id)
      }
      return next
    })
  }

  const runDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const res = await fetch('/api/profiles-cleanup/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids, allow_staff: allowDeleteStaff }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Delete failed')
      }
      const deleted: string[] = data.deleted || []
      const failed: { user_id: string; error: string }[] = data.failed || []
      const skipped: { user_id: string; reason: string }[] = data.skipped || []

      setSelected(new Set())
      await load()

      const parts = [
        deleted.length ? `Removed ${deleted.length}` : null,
        failed.length ? `${failed.length} failed` : null,
        skipped.length ? `${skipped.length} skipped` : null,
      ].filter(Boolean)

      toast({
        title: 'Delete finished',
        description: parts.join(' · ') || 'Nothing changed',
        variant: failed.length ? 'destructive' : 'default',
      })
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
      setAllowDeleteStaff(false)
    }
  }

  const runExportSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setExporting(true)
    try {
      const res = await fetch('/api/profiles-cleanup/demo-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Export failed')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-${stamp}.json`, data.backup)
      toast({
        title: 'Backup downloaded',
        description: `${data.backup?.users?.length ?? 0} user(s) in file`,
      })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const runExportAllDemo = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/profiles-cleanup/demo-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all_demo: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Export failed')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-all-${stamp}.json`, data.backup)
      toast({
        title: 'Backup downloaded',
        description: `${data.backup?.users?.length ?? 0} demo user(s) in file`,
      })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const runExportAndDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const ex = await fetch('/api/profiles-cleanup/demo-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids }),
      })
      const exData = await ex.json()
      if (!ex.ok) {
        throw new Error(exData.error || 'Export failed — nothing deleted')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-${stamp}.json`, exData.backup)

      const del = await fetch('/api/profiles-cleanup/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids, allow_staff: allowDeleteStaff }),
      })
      const delData = await del.json()
      if (!del.ok) {
        throw new Error(delData.error || 'Delete failed (backup file was still downloaded)')
      }
      const deleted: string[] = delData.deleted || []
      const failed: { user_id: string; error: string }[] = delData.failed || []
      const skipped: { user_id: string; reason: string }[] = delData.skipped || []

      setSelected(new Set())
      await load()

      toast({
        title: 'Exported and deleted',
        description: [
          `Saved ${exData.backup?.users?.length ?? 0} user(s) to file`,
          deleted.length ? `Removed ${deleted.length}` : null,
          failed.length ? `${failed.length} failed` : null,
          skipped.length ? `${skipped.length} skipped` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        variant: failed.length ? 'destructive' : 'default',
      })
    } catch (e) {
      toast({
        title: 'Export & delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setExportDeleteOpen(false)
      setAllowDeleteStaff(false)
    }
  }

  const onRestoreFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setRestoring(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('Invalid JSON file')
      }
      const res = await fetch('/api/profiles-cleanup/demo-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsed }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Restore failed')
      }
      const restored = data.restored || []
      const failed = data.failed || []
      await load()
      toast({
        title: 'Restore finished',
        description: [
          restored.length ? `Recreated ${restored.length} user(s)` : null,
          failed.length ? `${failed.length} failed (see console)` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        variant: failed.length ? 'destructive' : 'default',
      })
      if (failed.length) {
        console.warn('Demo restore failures:', failed)
      }
    } catch (e) {
      toast({
        title: 'Restore failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 sm:px-5 sm:py-4 mb-6 space-y-3">
        <div className="font-medium text-gray-900">Demo users — backup & restore</div>
        <p className="text-sm text-gray-600">
          Export includes email, the current <code className="text-xs bg-white px-1 rounded border">user_roles</code>{' '}
          value (any role when you export selected rows; &quot;all demo&quot; is always{' '}
          <code className="text-xs bg-white px-1 rounded border">demo</code>), and the full{' '}
          <code className="text-xs bg-white px-1 rounded border">profiles</code> row (storage bucket files
          are not touched). Restore creates new auth accounts (new user ids) with the same emails, roles,
          and profile fields. Passwords are randomized on restore — use password reset if needed.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={exporting || selected.size === 0}
            onClick={() => runExportSelected()}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? 'Working…' : 'Download backup (selected)'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={exporting}
            onClick={() => runExportAllDemo()}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? 'Working…' : 'Download all demo users'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-red-200 text-red-800 hover:bg-red-50 bg-white"
            disabled={selected.size === 0 || deleting || loading}
            onClick={() => setExportDeleteOpen(true)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download backup & delete selected…
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={restoring}
            onClick={() => restoreInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {restoring ? 'Restoring…' : 'Restore from JSON…'}
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onRestoreFile}
          />
        </div>
        <p className="text-xs text-gray-500">
          &quot;Download all demo users&quot; uses role <strong>demo</strong> in{' '}
          <code className="bg-white px-0.5 rounded border">user_roles</code> (includes accounts with no
          profile row). The table below only lists rows in{' '}
          <code className="bg-white px-0.5 rounded border">profiles</code>; use &quot;Download all demo
          users&quot; if you need demo accounts that have no profile row yet.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
            <Input
              placeholder="Search by id, name, username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md h-9 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={demoOnlyList}
                onChange={(e) => setDemoOnlyList(e.target.checked)}
              />
              Demo role only
            </label>
            <span className="text-xs text-gray-500 shrink-0">
              {filtered.length === profiles.length
                ? `${profiles.length} profiles`
                : `${filtered.length} of ${profiles.length}`}
              {selected.size > 0 ? ` · ${selected.size} selected` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9"
              disabled={loading || filtered.length === 0}
              onClick={() => toggleAllFiltered()}
              title="Select or clear all visible rows"
            >
              {allFilteredSelected ? 'Clear visible' : 'Select all visible'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9"
              disabled={selected.size === 0 || deleting || loading}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete selected
            </Button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {loading && profiles.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500 text-center">
              No profiles match your search.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={allFilteredSelected}
                      onChange={toggleAllFiltered}
                      aria-label="Select all visible"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell">
                    Username
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell">
                    Country
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden xl:table-cell">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.user_id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selected.has(p.user_id)}
                        onChange={() => toggle(p.user_id)}
                        aria-label={`Select ${p.user_id}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={p.profile_picture_url || undefined} alt="" />
                          <AvatarFallback className="text-[10px]">
                            {(p.name || p.username || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">
                              {p.name || '—'}
                            </span>
                            {p.role ? (
                              <Badge
                                variant={
                                  p.role === 'admin' || p.role === 'promoter'
                                    ? 'outline'
                                    : 'secondary'
                                }
                                className={cn(
                                  'shrink-0 text-[10px] font-normal px-1.5 py-0 h-5',
                                  roleBadgeClassName(p.role)
                                )}
                              >
                                {ROLE_LABELS[p.role] ?? p.role}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-[10px] font-normal text-gray-500 px-1.5 py-0 h-5"
                              >
                                No role
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {p.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-700 hidden lg:table-cell">
                      {p.username || '—'}
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 hidden md:table-cell">
                      {p.country_code || '—'}
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 text-xs hidden xl:table-cell whitespace-nowrap">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setAllowDeleteStaff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} user(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-600 space-y-3">
                <p>
                  For each user, admin/developer role rows (if any) are set to <strong>user</strong>{' '}
                  first, then the profile, all role rows, and the Supabase Auth user are removed.
                  Other tables that still reference this user may cause profile delete to fail for
                  some rows.
                </p>
                <p>
                  By default, accounts with <strong>admin</strong> or <strong>developer</strong> in{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code> are skipped so
                  you do not wipe panel access by mistake. That is why you saw &quot;skipped&quot;.
                </p>
                <p>
                  When allowed, each of those accounts is first demoted to role{' '}
                  <strong>user</strong> in <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code>, then
                  the profile, roles, and auth user are removed.
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-amber-400"
                    checked={allowDeleteStaff}
                    onChange={(e) => setAllowDeleteStaff(e.target.checked)}
                  />
                  <span>
                    Allow deleting <strong>admin</strong> / <strong>developer</strong> accounts in
                    this batch (demote to user, then delete; you still cannot delete your own
                    account).
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault()
                runDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportDeleteOpen}
        onOpenChange={(open) => {
          setExportDeleteOpen(open)
          if (!open) setAllowDeleteStaff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download backup and delete {selected.size} user(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-600 space-y-3">
                <p>
                  A JSON file is downloaded first, then the same delete as &quot;Delete selected&quot; runs
                  (profile rows, <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code>, auth
                  user — not storage).
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-amber-400"
                    checked={allowDeleteStaff}
                    onChange={(e) => setAllowDeleteStaff(e.target.checked)}
                  />
                  <span>
                    Allow deleting <strong>admin</strong> / <strong>developer</strong> if any slipped into
                    the selection (normally skipped).
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault()
                runExportAndDelete()
              }}
            >
              {deleting ? 'Working…' : 'Download & delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 text-xs text-gray-500">
        Temporary cleanup page — remove when finished.{' '}
        <Link href="/home" className="text-blue-600 hover:underline">
          Back to home
        </Link>
      </p>
    </>
  )
}
