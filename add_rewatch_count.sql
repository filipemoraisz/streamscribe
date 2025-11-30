-- Add rewatch_count column to watchlists table
ALTER TABLE watchlists 
ADD COLUMN rewatch_count INTEGER DEFAULT 0;

-- Comment on column
COMMENT ON COLUMN watchlists.rewatch_count IS 'Number of times the user has rewatched this item';
