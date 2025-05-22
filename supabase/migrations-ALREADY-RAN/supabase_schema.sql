-- Template Gallery Schema for GhostPost v2

-- Enable PostGIS extension for potential future geospatial features
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable RLS (Row Level Security) for the database
-- Note: You do not need to set role parameters directly in Supabase.

-- Create users table (managed by Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view other users" 
    ON users FOR SELECT USING (true);

CREATE POLICY "Users can update their own data" 
    ON users FOR UPDATE USING (auth.uid() = id);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add initial categories
INSERT INTO categories (name, description) VALUES
    ('Social Media', 'Templates designed for social media posts'),
    ('Presentations', 'Templates for professional presentations'),
    ('Educational', 'Templates for educational content'),
    ('Marketing', 'Templates for marketing materials'),
    ('Infographics', 'Data visualization templates')
ON CONFLICT (name) DO NOTHING;

-- Create template_gallery table
CREATE TABLE IF NOT EXISTS template_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    preview_image_url TEXT,
    template_data JSONB NOT NULL, -- Serialized project data
    slide_count INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    author_id UUID REFERENCES users(id),
    author_name TEXT, -- Denormalized for performance
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}'::TEXT[]
);

-- Add indexes for template_gallery
CREATE INDEX idx_template_gallery_category ON template_gallery(category_id);
CREATE INDEX idx_template_gallery_author ON template_gallery(author_id);
CREATE INDEX idx_template_gallery_featured ON template_gallery(is_featured);
CREATE INDEX idx_template_gallery_downloads ON template_gallery(downloads);
CREATE INDEX idx_template_gallery_likes ON template_gallery(likes);
CREATE INDEX idx_template_gallery_tags ON template_gallery USING GIN(tags);

-- Add RLS policies for template_gallery
ALTER TABLE template_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are viewable by everyone" 
    ON template_gallery FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert templates" 
    ON template_gallery FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own templates" 
    ON template_gallery FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own templates" 
    ON template_gallery FOR DELETE USING (auth.uid() = author_id);

-- Create user_template_interactions table for tracking likes and downloads
CREATE TABLE IF NOT EXISTS user_template_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES template_gallery(id) ON DELETE CASCADE,
    has_liked BOOLEAN NOT NULL DEFAULT false,
    has_downloaded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, template_id)
);

-- Add indexes for user_template_interactions
CREATE INDEX idx_interactions_user ON user_template_interactions(user_id);
CREATE INDEX idx_interactions_template ON user_template_interactions(template_id);

-- Add RLS policies for user_template_interactions
ALTER TABLE user_template_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all template interactions" 
    ON user_template_interactions FOR SELECT USING (true);

CREATE POLICY "Users can insert their own interactions" 
    ON user_template_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" 
    ON user_template_interactions FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update template stats when user interactions change
CREATE OR REPLACE FUNCTION update_template_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update likes count
    IF (TG_OP = 'INSERT' AND NEW.has_liked) OR 
       (TG_OP = 'UPDATE' AND NEW.has_liked <> OLD.has_liked) THEN
        
        IF NEW.has_liked THEN
            UPDATE template_gallery SET likes = likes + 1 WHERE id = NEW.template_id;
        ELSE
            UPDATE template_gallery SET likes = GREATEST(0, likes - 1) WHERE id = NEW.template_id;
        END IF;
    END IF;
    
    -- Update downloads count
    IF (TG_OP = 'INSERT' AND NEW.has_downloaded) OR 
       (TG_OP = 'UPDATE' AND NEW.has_downloaded <> OLD.has_downloaded) THEN
        
        IF NEW.has_downloaded THEN
            UPDATE template_gallery SET downloads = downloads + 1 WHERE id = NEW.template_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the function
CREATE TRIGGER user_template_interaction_trigger
AFTER INSERT OR UPDATE ON user_template_interactions
FOR EACH ROW EXECUTE FUNCTION update_template_stats();

-- Create function to denormalize author name
CREATE OR REPLACE FUNCTION update_template_author_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the author_name in the template when username changes
    UPDATE template_gallery 
    SET author_name = NEW.username,
        updated_at = NOW()
    WHERE author_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the function
CREATE TRIGGER user_update_trigger
AFTER UPDATE OF username ON users
FOR EACH ROW EXECUTE FUNCTION update_template_author_name();

-- Create anonymous access function for download without account
CREATE OR REPLACE FUNCTION increment_template_download(template_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE template_gallery SET downloads = downloads + 1 WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION increment_template_download TO anon;

-- Functions for template gallery management
CREATE OR REPLACE FUNCTION get_featured_templates(limit_count INTEGER DEFAULT 10)
RETURNS SETOF template_gallery AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM template_gallery
    WHERE is_featured = true
    ORDER BY created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_popular_templates(limit_count INTEGER DEFAULT 10)
RETURNS SETOF template_gallery AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM template_gallery
    ORDER BY downloads DESC, likes DESC, created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_recent_templates(limit_count INTEGER DEFAULT 10)
RETURNS SETOF template_gallery AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM template_gallery
    ORDER BY created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_templates(search_term TEXT, category_id INTEGER DEFAULT NULL, limit_count INTEGER DEFAULT 20)
RETURNS SETOF template_gallery AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM template_gallery
    WHERE (search_term IS NULL OR 
           name ILIKE '%' || search_term || '%' OR
           description ILIKE '%' || search_term || '%' OR
           search_term = ANY(tags))
    AND (category_id IS NULL OR category_id = template_gallery.category_id)
    ORDER BY 
        CASE WHEN name ILIKE '%' || search_term || '%' THEN 0 ELSE 1 END,
        downloads DESC,
        created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission for search functions
GRANT EXECUTE ON FUNCTION get_featured_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_popular_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_templates TO anon, authenticated;