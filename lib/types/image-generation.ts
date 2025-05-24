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
  source_images: File[]
} 