'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Copy, Check, Download, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CharacterGeneratedImage } from '@/types/database'

function formatPrompt(prompt: string): { isJson: boolean; content: string | React.ReactNode } {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(prompt.trim())
    // If successful, format it nicely
    return {
      isJson: true,
      content: (
        <pre className="text-xs text-white font-mono overflow-x-auto">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      ),
    }
  } catch {
    // Not JSON, return as plain text
    return {
      isJson: false,
      content: prompt,
    }
  }
}

interface GeneratedImagesGalleryProps {
  images: CharacterGeneratedImage[]
}

export function GeneratedImagesGallery({ images: initialImages }: GeneratedImagesGalleryProps) {
  const router = useRouter()
  const [images, setImages] = useState<CharacterGeneratedImage[]>(initialImages)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [archivingImageId, setArchivingImageId] = useState<string | null>(null)

  // Update images when prop changes
  useEffect(() => {
    setImages(initialImages)
  }, [initialImages])

  // Handle keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowLeft' && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1)
      } else if (e.key === 'ArrowRight' && selectedIndex < images.length - 1) {
        setSelectedIndex(selectedIndex + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, images.length])

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedImage) {
      try {
        await navigator.clipboard.writeText(selectedImage.prompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy prompt:', err)
      }
    }
  }

  const handleDownload = async (e: React.MouseEvent, image: CharacterGeneratedImage) => {
    e.stopPropagation()
    
    try {
      let imageUrl = image.image_url

      // If we have a Replicate prediction ID, fetch the original high-quality URL
      if (image.replicate_prediction_id) {
        const response = await fetch('/api/generate/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prediction_id: image.replicate_prediction_id,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          imageUrl = data.imageUrl
        }
      }

      // Download the image
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${image.generation_number}.${imageUrl.split('.').pop()?.split('?')[0] || 'png'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading image:', error)
      alert('Failed to download image. Please try again.')
    }
  }

  const handleArchive = async (e: React.MouseEvent, image: CharacterGeneratedImage) => {
    e.stopPropagation()
    
    if (archivingImageId) return // Prevent double-clicks
    
    setArchivingImageId(image.id)
    
    try {
      // Extract character ID from the image
      const response = await fetch(`/api/characters/${image.character_id}/generated-images/${image.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_archived: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive image')
      }

      // Find the index of the archived image
      const archivedImageIndex = images.findIndex(img => img.id === image.id)
      
      // Remove the archived image from local state immediately
      setImages(prevImages => prevImages.filter(img => img.id !== image.id))
      
      // Handle modal state if image was being viewed
      if (selectedIndex !== null) {
        if (archivedImageIndex === selectedIndex) {
          // Close modal if the archived image was being viewed
          setSelectedIndex(null)
        } else if (archivedImageIndex < selectedIndex) {
          // Adjust index if archived image was before the currently viewed one
          setSelectedIndex(selectedIndex - 1)
        }
        // If archived image was after the currently viewed one, no adjustment needed
      }
      
      // Reset archiving state
      setArchivingImageId(null)
      
      // Refresh to sync with server
      router.refresh()
    } catch (error) {
      console.error('Error archiving image:', error)
      alert(error instanceof Error ? error.message : 'Failed to archive image. Please try again.')
      setArchivingImageId(null)
    }
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">
          No generated images yet. Generate images using the Generate page.
        </p>
      </div>
    )
  }

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null

  return (
    <>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Generated Images ({images.length})
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative group cursor-pointer"
            onClick={() => setSelectedIndex(index)}
          >
            <div className="aspect-[9/16] relative rounded-lg overflow-hidden bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors">
              <Image
                src={image.image_url}
                alt={`Generated ${image.generation_number}`}
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs font-medium">#{image.generation_number}</p>
              <p className="text-xs truncate" title={image.prompt}>
                {image.prompt}
              </p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white"
                onClick={(e) => handleDownload(e, image)}
                title="Download image"
              >
                <Download className="h-4 w-4 text-gray-900" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white"
                onClick={(e) => handleArchive(e, image)}
                disabled={archivingImageId === image.id}
                title="Archive image"
              >
                <Archive className="h-4 w-4 text-gray-900" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      {selectedImage && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Blurred Background */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          {/* Content Container */}
          <div
            className="relative z-10 w-full h-full flex flex-col lg:flex-row items-center justify-center gap-4 sm:gap-6 px-4 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Container - Floating */}
            <div className="relative flex-1 w-full lg:w-auto h-[50vh] sm:h-[60vh] lg:h-[85vh] flex items-center justify-center">
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-transparent">
                <Image
                  src={selectedImage.image_url}
                  alt={`Generated ${selectedImage.generation_number}`}
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
            </div>

            {/* Prompt Info - Right Side / Bottom on Mobile */}
            <div className="w-full lg:w-[600px] shrink-0 bg-black/60 text-white px-4 sm:px-6 py-4 rounded-lg backdrop-blur-sm h-[35vh] sm:h-[40vh] lg:h-[85vh] overflow-y-auto">
              <div className="mb-4 pb-4 border-b border-white/20 flex items-center justify-between">
                <p className="text-sm font-medium">
                  #{selectedImage.generation_number} of {images.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => handleDownload(e, selectedImage)}
                    title="Download image in highest quality"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => handleArchive(e, selectedImage)}
                    disabled={archivingImageId === selectedImage.id}
                    title="Archive image"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Prompt
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-300 hover:text-white hover:bg-white/20"
                    onClick={handleCopyPrompt}
                    title="Copy prompt"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="text-sm text-white leading-relaxed">
                  {(() => {
                    const formatted = formatPrompt(selectedImage.prompt)
                    // Always render as JSON if it's JSON, otherwise as plain text
                    return formatted.isJson ? (
                      formatted.content
                    ) : (
                      <pre className="text-xs text-white font-mono whitespace-pre-wrap break-words">
                        {formatted.content}
                      </pre>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Close Button - Outside content container to ensure it's clickable */}
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 right-4 z-[60] text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedIndex(null)
            }}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation Arrows - Outside content container to ensure they're clickable */}
          {selectedIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-2 sm:left-6 z-[60] text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={(e) => {
                e.stopPropagation()
                handlePrevious(e)
              }}
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}
          
          {selectedIndex < images.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="fixed right-2 sm:right-6 lg:right-[632px] z-[60] text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={(e) => {
                e.stopPropagation()
                handleNext(e)
              }}
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}
        </div>
      )}
    </>
  )
}

