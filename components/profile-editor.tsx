'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ProfileEditorProps {
  initialName: string | null
  initialProfilePictureUrl: string | null
  email: string
}

export default function ProfileEditor({
  initialName,
  initialProfilePictureUrl,
  email,
}: ProfileEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(initialName || '')
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialProfilePictureUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      // Upload to Supabase Storage
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName)

      // Delete old profile picture if it exists and is from storage
      if (profilePictureUrl && profilePictureUrl.startsWith('http')) {
        try {
          const oldFileName = profilePictureUrl.split('/').pop()?.split('?')[0]
          if (oldFileName) {
            const oldPath = `${user.id}/${oldFileName}`
            await supabase.storage
              .from('profiles')
              .remove([oldPath])
          }
        } catch (error) {
          console.error('Error deleting old image:', error)
          // Don't fail the upload if old image deletion fails
        }
      }

      setProfilePictureUrl(publicUrl)
      setIsUploading(false)
      
      // Dispatch event to update breadcrumb immediately (even before saving)
      window.dispatchEvent(new CustomEvent('profile-updated', {
        detail: {
          name: name || null,
          profile_picture_url: publicUrl,
        }
      }))
      
      toast({
        title: 'Image uploaded',
        description: 'Profile picture uploaded successfully.',
      })
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast({
        title: 'Upload failed',
        description: error.message || 'An error occurred while uploading the image.',
        variant: 'destructive',
      })
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim() || null,
          profile_picture_url: profilePictureUrl || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      })

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('profile-updated', {
        detail: {
          name: name.trim() || null,
          profile_picture_url: profilePictureUrl || null,
        }
      }))

      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Update failed',
        description: error.message || 'An error occurred while updating your profile.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your name and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email and Name in the same row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              Email cannot be changed
            </p>
          </div>
        </div>

        {/* Profile Picture */}
        <div className="space-y-2">
          <Label>Profile Picture</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              {profilePictureUrl ? (
                <Image
                  src={profilePictureUrl}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                  <User className="h-10 w-10 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Image'}
              </Button>
              {profilePictureUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    // Delete from storage if it's a storage URL
                    if (profilePictureUrl.startsWith('http')) {
                      try {
                        const { createClient } = await import('@/lib/supabase/client')
                        const supabase = createClient()
                        const { data: { user } } = await supabase.auth.getUser()
                        
                        if (user) {
                          const fileName = profilePictureUrl.split('/').pop()?.split('?')[0]
                          if (fileName) {
                            const filePath = `${user.id}/${fileName}`
                            await supabase.storage
                              .from('profiles')
                              .remove([filePath])
                          }
                        }
                      } catch (error) {
                        console.error('Error deleting image:', error)
                      }
                    }
                    setProfilePictureUrl(null)
                  }}
                >
                  Remove
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Recommended: Square image, at least 200x200px
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

