-- Add new column for override amount
ALTER TABLE damages ADD COLUMN IF NOT EXISTS override_amount_in_cents INTEGER;

-- Rename estimated_cost_in_cents to estimated_amount_in_cents for consistency
ALTER TABLE damages RENAME COLUMN estimated_cost_in_cents TO estimated_amount_in_cents;
