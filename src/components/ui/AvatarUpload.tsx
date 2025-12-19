import React, { useCallback, useState } from 'react'
import { Upload, X, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'
import { toast } from '@/hooks/use-toast'
import { uploadFile } from '@/services/cloudflare-storage'
import { STORAGE_PATHS } from '@/config/cloudflare'

interface AvatarUploadProps {
  onImageUploaded?: (url: string) => void
  className?: string
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ onImageUploaded, className = '' }) => {
  const { profile, updateProfile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const uploadImage = async (file: File) => {
    try {
      setUploading(true)

      // Validate file
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, WebP, or GIF)')
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Image size must be less than 5MB')
      }

      if (!profile?.id) {
        throw new Error('User not authenticated')
      }

      // Create file path for Cloudflare R2
      const fileExt = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const filePath = STORAGE_PATHS.profileImage(profile.id, timestamp, fileExt)

      // Upload to Cloudflare R2
      const uploadResult = await uploadFile({
        filePath,
        file,
        contentType: file.type,
      })

      // Update profile with new image URL
      const { error: updateError } = await updateProfile({
        profile_image_url: uploadResult.publicUrl
      })

      if (updateError) {
        throw updateError
      }

      toast({
        title: "Profile image updated",
        description: "Your profile image has been successfully updated.",
      })

      onImageUploaded?.(uploadResult.publicUrl)

    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadImage(file)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      uploadImage(file)
    }
  }, [])

  const removeImage = async () => {
    try {
      setUploading(true)

      // Update profile to remove image URL
      const { error } = await updateProfile({ 
        profile_image_url: null 
      })

      if (error) {
        throw error
      }

      toast({
        title: "Profile image removed",
        description: "Your profile image has been removed.",
      })

    } catch (error: any) {
      console.error('Error removing image:', error)
      toast({
        title: "Failed to remove image",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  if (!profile) {
    return null
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage 
            src={profile.profile_image_url || undefined} 
            alt={profile.first_name}
          />
          <AvatarFallback className="bg-indigo-100 text-action-primary font-semibold text-lg">
            {getInitials(profile.first_name)}
          </AvatarFallback>
        </Avatar>
        
        {profile.profile_image_url && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={removeImage}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 w-full max-w-sm text-center transition-colors
          ${dragActive ? 'border-action-primary bg-indigo-50' : 'border-gray-300'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="flex flex-col items-center space-y-2">
          <Upload className="h-8 w-8 text-gray-400" />
          <div className="text-sm text-gray-600">
            <span className="font-medium text-action-primary hover:text-indigo-700">
              Click to upload
            </span>
            {' '}or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            PNG, JPG, WebP or GIF up to 5MB
          </p>
        </div>
      </div>

      {uploading && (
        <div className="text-sm text-gray-500">
          Uploading...
        </div>
      )}
    </div>
  )
}

export default AvatarUpload