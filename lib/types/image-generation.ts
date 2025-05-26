export interface ImageGenerationJob {
  id: string
  name: string
  template_id?: string
  template_name: string
  template_description?: string
  prompt: string
  variants: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  created_at: string
  completed_at?: string
  user_id: string
  // Relations
  template?: ImageGenerationTemplate
  generated_images?: GeneratedCarouselImage[]
}

export interface ImageGenerationTemplate {
  id: string
  name: string
  description?: string
  source_images: string[]
  thumbnail_url?: string
  default_prompt?: string
  is_favorite: boolean
  created_at: string
  user_id: string
}

export interface GeneratedCarouselImage {
  id: string
  job_id: string
  carousel_index: number
  image_index: number
  source_image_url: string
  generated_image_url: string
  storage_path?: string
  width: number
  height: number
  prompt_used: string
  created_at: string
  user_id: string
}

export interface ImageGenerationSettings {
  temperature?: number
  use_lowercase?: boolean
  add_borders?: boolean
  border_color?: string
  add_effects?: boolean
  aspect_ratio?: '1:1' | '3:2' | '2:3' | '16:9' | '9:16' | 'auto'
  quality?: 'standard' | 'hd'
  // Anti-shadowban settings
  antiShadowban?: AntiShadowbanSettings
}

export interface AntiShadowbanSettings {
  preset: 'light' | 'standard' | 'maximum' | 'custom'
  // Metadata settings
  metadata: {
    enabled: boolean
    deviceType: 'iphone12' | 'iphone13' | 'iphone14' | 'iphone15' | 'random'
    locationVariance: number // km radius for GPS variance
    baseLocation?: { lat: number; lng: number } // If not provided, will use random major cities
  }
  // Border settings
  borders: {
    enabled: boolean
    minWidth: number
    maxWidth: number
    colorMode: 'random' | 'sampled' | 'custom'
    customColors?: string[] // Hex colors if colorMode is custom
    asymmetric: boolean // Different width on each edge
  }
  // Fracture settings
  fractures: {
    enabled: boolean
    intensity: 'subtle' | 'light' | 'medium'
    count: number // Number of fracture lines
    opacity: number // 0-100
  }
  // Advanced modifications
  microNoise: {
    enabled: boolean
    intensity: number // 0-100
  }
  colorShift: {
    enabled: boolean
    hueVariance: number // degrees
    saturationVariance: number // percentage
    lightnessVariance: number // percentage
  }
  compression: {
    enabled: boolean
    qualityMin: number // 85-95
    qualityMax: number // 90-100
  }
  invisibleWatermark: {
    enabled: boolean
    data: string // Custom data to embed
  }
  // File handling
  fileNaming: {
    pattern: 'iphone' | 'sequential' | 'random'
    sequentialStart?: number
  }
  processingDelay: {
    enabled: boolean
    minMs: number
    maxMs: number
  }
}

export interface AntiShadowbanPreset {
  name: 'light' | 'standard' | 'maximum'
  description: string
  settings: Partial<AntiShadowbanSettings>
}

export interface CreateJobParams {
  name: string
  template_id?: string
  template_name: string
  template_description?: string
  prompt: string
  variants: number
  source_images: File[]
} 