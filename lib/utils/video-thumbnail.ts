/**
 * Utility functions for generating video thumbnails
 */

export interface VideoThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  timeOffset?: number // Time in seconds to capture thumbnail
}

/**
 * Generate a thumbnail from a video URL
 */
export async function generateVideoThumbnail(
  videoUrl: string, 
  options: VideoThumbnailOptions = {}
): Promise<string | null> {
  const {
    width = 300,
    height = 300,
    quality = 0.8,
    timeOffset = 1
  } = options

  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      resolve(null)
      return
    }

    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      // Set canvas dimensions
      canvas.width = width
      canvas.height = height
      
      // Seek to the specified time offset (or 1 second, or 10% of duration)
      const seekTime = Math.min(timeOffset, video.duration * 0.1, video.duration - 0.1)
      video.currentTime = Math.max(seekTime, 0)
    }

    video.onseeked = () => {
      try {
        // Calculate aspect ratio and positioning
        const videoAspect = video.videoWidth / video.videoHeight
        const canvasAspect = width / height
        
        let drawWidth = width
        let drawHeight = height
        let offsetX = 0
        let offsetY = 0

        if (videoAspect > canvasAspect) {
          // Video is wider than canvas
          drawHeight = height
          drawWidth = height * videoAspect
          offsetX = (width - drawWidth) / 2
        } else {
          // Video is taller than canvas
          drawWidth = width
          drawHeight = width / videoAspect
          offsetY = (height - drawHeight) / 2
        }

        // Fill background with black
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
        
        // Draw video frame
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)
        
        // Convert to data URL
        const thumbnailUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(thumbnailUrl)
      } catch (error) {
        console.error('Error generating video thumbnail:', error)
        resolve(null)
      }
    }

    video.onerror = () => {
      console.error('Error loading video for thumbnail generation')
      resolve(null)
    }

    video.src = videoUrl
  })
}

/**
 * Generate multiple thumbnails from a video at different time points
 */
export async function generateVideoThumbnails(
  videoUrl: string,
  count: number = 3,
  options: VideoThumbnailOptions = {}
): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const thumbnails: string[] = []
    let currentIndex = 0

    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'

    const generateThumbnailAtTime = (timeOffset: number) => {
      return generateVideoThumbnail(videoUrl, { ...options, timeOffset })
    }

    video.onloadedmetadata = async () => {
      const duration = video.duration
      const timePoints = []
      
      // Generate time points evenly distributed across the video
      for (let i = 0; i < count; i++) {
        const timePoint = (duration / (count + 1)) * (i + 1)
        timePoints.push(timePoint)
      }

      // Generate thumbnails for each time point
      const thumbnailPromises = timePoints.map(time => 
        generateThumbnailAtTime(time)
      )

      const results = await Promise.all(thumbnailPromises)
      resolve(results.filter(Boolean) as string[])
    }

    video.onerror = () => {
      resolve([])
    }

    video.src = videoUrl
  })
}

/**
 * Check if video thumbnail generation is supported
 */
export function isVideoThumbnailSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    return !!ctx && typeof document.createElement('video').canPlayType === 'function'
  } catch {
    return false
  }
} 