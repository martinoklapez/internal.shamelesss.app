'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Upload, X, Star, StarOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CharacterReferenceImage } from '@/types/database'

interface ReferenceImagesManagerProps {
  characterId: string
  initialImages: CharacterReferenceImage[]
}

export function ReferenceImagesManager({
  characterId,
  initialImages,
}: ReferenceImagesManagerProps) {
  const router = useRouter()
  const [images, setImages] = useState<CharacterReferenceImage[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `/api/characters/${characterId}/reference-images/upload`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload image')
      }

      const newImage = await response.json()
      setImages([...images, newImage])
      router.refresh()

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this reference image?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/characters/${characterId}/reference-images/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: imageId }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete image')
      }

      setImages(images.filter(img => img.id !== imageId))
      router.refresh()
    } catch (error) {
      console.error('Error deleting image:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete image')
    }
  }

  const handleToggleDefault = async (imageId: string, currentValue: boolean) => {
    setToggling(imageId)

    try {
      const response = await fetch(
        `/api/characters/${characterId}/reference-images/toggle-default`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: imageId, is_default: !currentValue }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update image')
      }

      const updatedImage = await response.json()
      setImages(images.map(img => img.id === imageId ? updatedImage : img))
      router.refresh()
    } catch (error) {
      console.error('Error toggling default:', error)
      alert(error instanceof Error ? error.message : 'Failed to update image')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Reference Images</h3>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-8 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">
            No reference images. Upload images to use as references for generation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
            >
              <div className="aspect-square relative">
                <Image
                  src={image.image_url}
                  alt="Reference"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 w-7 p-0"
                  onClick={() => handleToggleDefault(image.id, image.is_default)}
                  disabled={toggling === image.id}
                  title={image.is_default ? 'Remove from defaults' : 'Set as default'}
                >
                  {image.is_default ? (
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ) : (
                    <StarOff className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDelete(image.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {image.is_default && (
                <div className="absolute bottom-2 left-2">
                  <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-medium">
                    Default
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

