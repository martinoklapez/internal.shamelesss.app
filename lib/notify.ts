import { toast } from '@/hooks/use-toast'

export function notifyError(message: string, title = 'Something went wrong') {
  toast({ variant: 'destructive', title, description: message })
}

export function notifySuccess(message: string, title = 'Done') {
  toast({ title, description: message })
}
