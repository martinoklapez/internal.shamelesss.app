'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Sparkles, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AICharacter, CharacterReferenceImage, CharacterGeneratedImage } from '@/types/database'

interface GenerateImageFormProps {
  characters: AICharacter[]
  characterData: Record<string, { reference_images: CharacterReferenceImage[] }>
}

export function GenerateImageForm({ characters, characterData }: GenerateImageFormProps) {
  const router = useRouter()
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    characters.length > 0 ? characters[0].id : ''
  )
  const [prompt, setPrompt] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [resolution, setResolution] = useState('1k')
  const [outputFormat, setOutputFormat] = useState('png')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<CharacterGeneratedImage | null>(null)
  const [progress, setProgress] = useState('')

  const currentCharacter = characters.find(c => c.id === selectedCharacterId)
  const referenceImages = currentCharacter
    ? characterData[currentCharacter.id]?.reference_images || []
    : []

  // Update selected reference images when character changes
  useEffect(() => {
    if (currentCharacter) {
      const defaultImages = referenceImages
        .filter(img => img.is_default)
        .map(img => img.id)
      setSelectedReferenceIds(defaultImages)
    }
  }, [selectedCharacterId, currentCharacter, referenceImages])

  const handleToggleReference = (imageId: string) => {
    setSelectedReferenceIds(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    )
  }

  const handleGenerate = async () => {
    if (!selectedCharacterId || !prompt.trim()) {
      return
    }

    setIsGenerating(true)
    setProgress('Creating prediction...')
    setGeneratedImage(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character_id: selectedCharacterId,
          prompt: prompt.trim(),
          selected_reference_image_ids: selectedReferenceIds.length > 0
            ? selectedReferenceIds
            : undefined,
          aspect_ratio: aspectRatio || undefined,
          resolution: resolution || undefined,
          output_format: outputFormat || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate image')
      }

      const result = await response.json()
      setGeneratedImage(result)
      setProgress('')
      router.refresh()
    } catch (error) {
      console.error('Error generating image:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate image')
      setProgress('')
    } finally {
      setIsGenerating(false)
    }
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-8 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">
          No characters found. Create a character first to generate images.
        </p>
      </div>
    )
  }

  const selectedImages = referenceImages.filter(img => selectedReferenceIds.includes(img.id))

  return (
    <div className="h-full flex bg-white">
      {/* Left Column - Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6 max-w-4xl mx-auto">
          <div className="grid gap-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="character">Character *</Label>
                <Select
                  value={selectedCharacterId}
                  onValueChange={setSelectedCharacterId}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a character" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.map((character) => (
                      <SelectItem key={character.id} value={character.id}>
                        {character.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aspect_ratio">Aspect Ratio</Label>
                <Select
                  value={aspectRatio || undefined}
                  onValueChange={(value) => setAspectRatio(value || '')}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="2:3">2:3</SelectItem>
                    <SelectItem value="3:2">3:2</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="4:5">4:5</SelectItem>
                    <SelectItem value="5:4">5:4</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="21:9">21:9</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select
                  value={resolution || undefined}
                  onValueChange={(value) => setResolution(value || '')}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1k">1k</SelectItem>
                    <SelectItem value="2k">2k</SelectItem>
                    <SelectItem value="4k">4k</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="output_format">Output Format</Label>
                <Select
                  value={outputFormat || undefined}
                  onValueChange={(value) => setOutputFormat(value || '')}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {referenceImages.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-sm">Reference Images</Label>
                <div className="grid grid-cols-4 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-40 overflow-y-auto">
                  {referenceImages.map((image) => {
                    const isSelected = selectedReferenceIds.includes(image.id)
                    return (
                      <div
                        key={image.id}
                        className="relative aspect-square cursor-pointer group"
                        onClick={() => handleToggleReference(image.id)}
                      >
                        <div className={`relative w-full h-full border-2 rounded-lg overflow-hidden transition-colors ${
                          isSelected ? 'border-blue-500' : 'border-gray-300'
                        }`}>
                          <Image
                            src={image.image_url}
                            alt="Reference"
                            fill
                            className="object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">✓</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {image.is_default && (
                          <div className="absolute -top-1 -right-1">
                            <span className="text-[10px] bg-yellow-400 text-yellow-900 px-1 rounded">
                              ★
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="prompt" className="text-sm">Prompt *</Label>
              <Textarea
                id="prompt"
                placeholder='Describe the image you want to generate...\n\nOr use JSON format:\n{\n  "subject": {\n    "demographics": "...",\n    "hair": {...},\n    "face": {...}\n  }\n}'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                className="min-h-[280px] resize-y font-mono text-sm"
                required
              />
            </div>


            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || !selectedCharacterId}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>

            {progress && (
              <p className="text-sm text-gray-600 text-center">{progress}</p>
            )}

          </div>
        </div>
      </div>

      {/* Right Column - Generated Image Preview */}
      <div className="w-[400px] shrink-0 flex flex-col bg-white">
        <div className="flex items-start justify-center p-6 overflow-y-auto">
          {generatedImage ? (
            <div className="relative w-full border border-gray-200 rounded-lg overflow-hidden bg-white group" style={{ aspectRatio: '9/16' }}>
              <Image
                src={generatedImage.image_url}
                alt="Generated"
                fill
                className="object-contain"
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 bg-white/90 hover:bg-white shadow-sm"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      let imageUrl = generatedImage.image_url

                      // If we have a Replicate prediction ID, fetch the original high-quality URL
                      if (generatedImage.replicate_prediction_id) {
                        const response = await fetch('/api/generate/download', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            prediction_id: generatedImage.replicate_prediction_id,
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
                      a.download = `generated-image-${generatedImage.generation_number}.${imageUrl.split('.').pop()?.split('?')[0] || 'png'}`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (error) {
                      console.error('Error downloading image:', error)
                      alert('Failed to download image. Please try again.')
                    }
                  }}
                  title="Download image in highest quality"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-white" style={{ aspectRatio: '9/16' }}>
              <p className="text-xs text-gray-400 text-center px-4">
                Generate an image to see it here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

