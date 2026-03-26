'use client'

import * as React from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type AppConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export type AppPromptOptions = {
  title: string
  description?: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
}

type AppDialogsContextValue = {
  confirm: (options: AppConfirmOptions) => Promise<boolean>
  prompt: (options: AppPromptOptions) => Promise<string | null>
}

const AppDialogsContext = React.createContext<AppDialogsContextValue | null>(null)

export function useAppDialogs() {
  const ctx = React.useContext(AppDialogsContext)
  if (!ctx) {
    throw new Error('useAppDialogs must be used within AppDialogsProvider')
  }
  return ctx
}

export function AppDialogsProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = React.useState<
    (AppConfirmOptions & { open: boolean }) | null
  >(null)
  const confirmResolverRef = React.useRef<((value: boolean) => void) | null>(null)
  const confirmSettledRef = React.useRef(false)

  const [promptState, setPromptState] = React.useState<
    (AppPromptOptions & { open: boolean }) | null
  >(null)
  const promptResolverRef = React.useRef<((value: string | null) => void) | null>(null)
  const promptSettledRef = React.useRef(false)
  const [promptValue, setPromptValue] = React.useState('')

  const finishConfirm = React.useCallback((value: boolean) => {
    if (confirmSettledRef.current) return
    confirmSettledRef.current = true
    const resolve = confirmResolverRef.current
    confirmResolverRef.current = null
    resolve?.(value)
    setConfirmState(null)
  }, [])

  const confirm = React.useCallback((options: AppConfirmOptions) => {
    confirmSettledRef.current = false
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve
      setConfirmState({ ...options, open: true })
    })
  }, [])

  const finishPrompt = React.useCallback((value: string | null) => {
    if (promptSettledRef.current) return
    promptSettledRef.current = true
    const resolve = promptResolverRef.current
    promptResolverRef.current = null
    resolve?.(value)
    setPromptState(null)
    setPromptValue('')
  }, [])

  const prompt = React.useCallback((options: AppPromptOptions) => {
    promptSettledRef.current = false
    setPromptValue(options.defaultValue ?? '')
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve
      setPromptState({ ...options, open: true })
    })
  }, [])

  const ctx = React.useMemo(() => ({ confirm, prompt }), [confirm, prompt])

  return (
    <AppDialogsContext.Provider value={ctx}>
      {children}

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open) {
            if (!confirmSettledRef.current) {
              finishConfirm(false)
            }
            confirmSettledRef.current = false
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description ? (
              <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
            ) : (
              <AlertDialogDescription className="sr-only">Confirm this action.</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirmState?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmState?.variant === 'destructive' && buttonVariants({ variant: 'destructive' })
              )}
              onClick={() => finishConfirm(true)}
            >
              {confirmState?.confirmLabel ?? 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!promptState}
        onOpenChange={(open) => {
          if (!open) {
            if (!promptSettledRef.current) {
              finishPrompt(null)
            }
            promptSettledRef.current = false
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.title}</DialogTitle>
            {promptState?.description ? (
              <DialogDescription>{promptState.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-2 py-2">
            {promptState?.label ? <Label htmlFor="app-prompt-input">{promptState.label}</Label> : null}
            <Input
              id="app-prompt-input"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptState?.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finishPrompt(promptValue.trim() || null)
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finishPrompt(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => finishPrompt(promptValue.trim() || null)}
            >
              {promptState?.confirmLabel ?? 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppDialogsContext.Provider>
  )
}
