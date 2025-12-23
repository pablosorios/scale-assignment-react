-- Enable RLS on damages table (if not already enabled)
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access" ON damages;
DROP POLICY IF EXISTS "Allow public insert access" ON damages;

-- Create policies for public access (for reviewers)
CREATE POLICY "Allow public read access" ON damages
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access" ON damages
  FOR INSERT
  TO anon
  WITH CHECK (true);
