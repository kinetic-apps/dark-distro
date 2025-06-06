'use client'

import { useState, useEffect, useRef } from 'react'
import { Video, Play } from 'lucide-react'
import { generateVideoThumbnail, isVideoThumbnailSupported } from '@/lib/utils/video-thumbnail'

interface VideoThumbnailProps {
  videoUrl: string
  className?: string
  width?: number
  height?: number
  timeOffset?: number
  showPlayIcon?: boolean
  onClick?: () => void
}

// Simple in-memory cache for thumbnails
const thumbnailCache = new Map<string, string>()

export default function VideoThumbnail({
  videoUrl,
  className = '',
  width = 300,
  height = 300,
  timeOffset = 1,
  showPlayIcon = true,
  onClick
}: VideoThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false)
      setError(true)
      return
    }

    // Check if thumbnail generation is supported
    if (!isVideoThumbnailSupported()) {
      setLoading(false)
      setError(true)
      return
    }

    // Create cache key
    const cacheKey = `${videoUrl}_${width}_${height}_${timeOffset}`
    
    // Check cache first
    if (thumbnailCache.has(cacheKey)) {
      setThumbnailUrl(thumbnailCache.get(cacheKey)!)
      setLoading(false)
      return
    }

    // Generate thumbnail
    const generateThumbnail = async () => {
      try {
        setLoading(true)
        setError(false)

        const thumbnail = await generateVideoThumbnail(videoUrl, {
          width,
          height,
          timeOffset,
          quality: 0.8
        })

        if (!mountedRef.current) return

        if (thumbnail) {
          // Cache the thumbnail
          thumbnailCache.set(cacheKey, thumbnail)
          setThumbnailUrl(thumbnail)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error('Error generating video thumbnail:', err)
        if (mountedRef.current) {
          setError(true)
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    generateThumbnail()
  }, [videoUrl, width, height, timeOffset])

  if (loading) {
    return (
      <div 
        className={`bg-gray-100 dark:bg-dark-800 flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-2">
          <Video className="h-8 w-8 text-gray-400 animate-pulse" />
          <div className="text-xs text-gray-500 dark:text-dark-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (error || !thumbnailUrl) {
    return (
      <div 
        className={`bg-gray-100 dark:bg-dark-800 flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-2">
          <Video className="h-8 w-8 text-gray-400" />
          <div className="text-xs text-gray-500 dark:text-dark-400">Video</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onClick={onClick}
    >
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
      />
      
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black bg-opacity-60 rounded-full p-3">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
      )}
      
      {/* Video duration badge could go here if we had that metadata */}
    </div>
  )
} 