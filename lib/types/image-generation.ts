export interface ImageGenerationJob {
  id: string
  name: string
  template_id?: string
  template_name: string
  template_description?: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  variants: number
  prompt: string
  settings: ImageGenerationSettings
  created_at: string
  updated_at: string
  completed_at?: string
  user_id: string
  // Virtual fields populated from joins
  generated_images?: GeneratedCarouselImage[]
  template?: ImageGenerationTemplate
}

export interface ImageGenerationTemplate {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
  source_images: string[]
  default_prompt?: string
  default_settings: ImageGenerationSettings
  usage_count: number
  is_favorite: boolean
  created_at: string
  updated_at: string
  user_id: string
}

export interface GeneratedCarouselImage {
  id: string
  job_id: string
  carousel_index: number
  image_index: number
  source_image_url?: string
  generated_image_url: string
  storage_path?: string
  width?: number
  height?: number
  prompt_used: string
  settings_used: ImageGenerationSettings
  created_at: string
  user_id: string
}

export interface ImageGenerationSettings {
  temperature?: number
  use_lowercase?: boolean
  add_borders?: boolean
  border_color?: string
  add_effects?: boolean
  aspect_ratio?: '1:1' | '4:5' | '9:16'
  quality?: 'standard' | 'hd'
}

export interface CreateJobParams {
  name: string
  template_id?: string
  template_name: string
  template_description?: string
  prompt: string
  variants: number
  settings: ImageGenerationSettings
  source_images: File[]
} 