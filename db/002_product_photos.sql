ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_source_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
