-- Create templates table first since jobs references it
CREATE TABLE IF NOT EXISTS public.image_generation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  source_images JSONB DEFAULT '[]',
  default_prompt TEXT,
  default_settings JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create image generation jobs table
CREATE TABLE IF NOT EXISTS public.image_generation_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES public.image_generation_templates(id),
  template_name VARCHAR(255) NOT NULL,
  template_description TEXT,
  status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message TEXT,
  variants INTEGER DEFAULT 1,
  prompt TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create generated images table
CREATE TABLE IF NOT EXISTS public.generated_carousel_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.image_generation_jobs(id) ON DELETE CASCADE,
  carousel_index INTEGER NOT NULL,
  image_index INTEGER NOT NULL,
  source_image_url TEXT,
  generated_image_url TEXT NOT NULL,
  storage_path TEXT,
  width INTEGER,
  height INTEGER,
  prompt_used TEXT,
  settings_used JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(job_id, carousel_index, image_index)
);

-- Add indexes for performance
CREATE INDEX idx_jobs_user_id ON public.image_generation_jobs(user_id);
CREATE INDEX idx_jobs_status ON public.image_generation_jobs(status);
CREATE INDEX idx_jobs_created_at ON public.image_generation_jobs(created_at DESC);
CREATE INDEX idx_templates_user_id ON public.image_generation_templates(user_id);
CREATE INDEX idx_templates_favorite ON public.image_generation_templates(is_favorite, user_id);
CREATE INDEX idx_generated_images_job_id ON public.generated_carousel_images(job_id);
CREATE INDEX idx_generated_images_user_id ON public.generated_carousel_images(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.image_generation_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.image_generation_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_generation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_carousel_images ENABLE ROW LEVEL SECURITY;

-- Jobs policies
CREATE POLICY "Users can view their own jobs" ON public.image_generation_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" ON public.image_generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" ON public.image_generation_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" ON public.image_generation_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Users can view their own templates" ON public.image_generation_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" ON public.image_generation_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON public.image_generation_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON public.image_generation_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Generated images policies
CREATE POLICY "Users can view their own generated images" ON public.generated_carousel_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated images" ON public.generated_carousel_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images" ON public.generated_carousel_images
  FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-carousels',
  'generated-carousels',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated-carousels bucket
CREATE POLICY "Users can upload their own carousel images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'generated-carousels' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own carousel images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated-carousels' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own carousel images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'generated-carousels' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  ); 