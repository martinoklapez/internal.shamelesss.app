'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PipelineAssetBrowserDialog } from '@/components/pipeline-asset-browser-dialog'
import type { PipelineAssetScope } from '@/lib/database/creator-pipeline/pipeline-assets'
import { hostInitials } from '@/lib/creator-outreach/cal-booking'
import { uploadPipelineImage } from '@/lib/creator-outreach/upload-pipeline-image'
import { cn } from '@/lib/utils'
import { FolderOpen, ImagePlus, Loader2, X } from 'lucide-react'

type PipelineImageUploadProps = {
  scope: PipelineAssetScope
  ownerId: string
  value?: string
  onChange?: (url: string) => void
  onUploaded?: (url: string) => void
  label?: string
  hint?: string
  variant?: 'avatar' | 'image'
  hostName?: string
  className?: string
}

export function PipelineImageUpload({
  scope,
  ownerId,
  value = '',
  onChange,
  onUploaded,
  label = 'Image',
  hint,
  variant = 'image',
  hostName,
  className,
}: PipelineImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyUrl = (url: string) => {
    onChange?.(url)
    onUploaded?.(url)
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadPipelineImage(file, scope, ownerId)
      applyUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = () => {
    onChange?.('')
    setError(null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">{label}</Label>

      <div className="flex flex-wrap items-start gap-3">
        {variant === 'avatar' ? (
          <Avatar className="h-12 w-12 border border-gray-200 bg-gray-100">
            {value ? <AvatarImage src={value} alt={hostName || 'Host'} /> : null}
            <AvatarFallback className="bg-gray-100 text-xs font-medium text-gray-600">
              {hostInitials(hostName || 'Host')}
            </AvatarFallback>
          </Avatar>
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-12 max-w-[8rem] rounded-md border border-gray-200 bg-white object-contain p-1"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={uploading}
            onClick={() => setBrowserOpen(true)}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Browse
          </Button>
          {value && onChange ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-gray-500"
              disabled={uploading}
              onClick={clear}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {onChange ? (
        <Input
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder="Or paste an image URL"
          disabled={uploading}
        />
      ) : null}

      {hint ? <p className="text-[11px] text-gray-500 leading-relaxed">{hint}</p> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

      <PipelineAssetBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={applyUrl}
        scope={scope}
        title="Choose image"
      />
    </div>
  )
}
