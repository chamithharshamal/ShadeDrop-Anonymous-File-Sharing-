-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  delete_after_send BOOLEAN DEFAULT false,
  one_time BOOLEAN DEFAULT false,
  sent BOOLEAN DEFAULT false,
  email TEXT,
  password_hash TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_sent ON files(sent);

-- Enable Row Level Security
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts (for file uploads)
CREATE POLICY "Anyone can insert files" ON files
FOR INSERT TO anon
WITH CHECK (true);

-- Create policy to allow selects for file downloads (disabled for anon, use service key instead)
CREATE POLICY "Anyone can select files" ON files
FOR SELECT TO anon
USING (false);

-- Create policy to allow updates for sent status (disabled for anon, use service key instead)
CREATE POLICY "Anyone can update sent status" ON files
FOR UPDATE TO anon
USING (false)
WITH CHECK (false);