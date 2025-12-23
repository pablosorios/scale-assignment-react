-- Drop and recreate damage_history table to ensure correct schema
DROP TABLE IF EXISTS public.damage_history CASCADE;

CREATE TABLE public.damage_history (
    id BIGSERIAL PRIMARY KEY,
    damage_id BIGINT NOT NULL REFERENCES public.damages(id),
    event_type TEXT NOT NULL, -- 'created', 'approved', 'refused'
    status TEXT, -- 'pending', 'approved', 'refused'
    refusal_reason TEXT, -- 'Unclear Evidence', 'Overblown Estimation', etc.
    refusal_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT -- 'Claims Agent' or 'Claims Adjuster'
);

-- Add RLS policies for damage_history (allow public read for demo)
ALTER TABLE public.damage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to damage_history" ON public.damage_history;
CREATE POLICY "Allow public read access to damage_history"
ON public.damage_history FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public insert to damage_history" ON public.damage_history;
CREATE POLICY "Allow public insert to damage_history"
ON public.damage_history FOR INSERT
TO public
WITH CHECK (true);

-- Add status column to damages table if it doesn't exist
ALTER TABLE public.damages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update existing damages to have 'pending' status
UPDATE public.damages SET status = 'pending' WHERE status IS NULL;

-- Insert mock damage history data for existing damages
-- This will create history for up to the first 6 damages in your table

DO $$
DECLARE
  damage_ids INTEGER[];
  damage_id_1 INTEGER;
  damage_id_2 INTEGER;
  damage_id_3 INTEGER;
  damage_id_4 INTEGER;
  damage_id_5 INTEGER;
  damage_id_6 INTEGER;
BEGIN
  -- Get the first 6 damage IDs that exist
  SELECT ARRAY_AGG(id ORDER BY id) INTO damage_ids 
  FROM (SELECT id FROM public.damages ORDER BY id LIMIT 6) AS subquery;
  
  -- Assign variables
  IF array_length(damage_ids, 1) >= 1 THEN damage_id_1 := damage_ids[1]; END IF;
  IF array_length(damage_ids, 1) >= 2 THEN damage_id_2 := damage_ids[2]; END IF;
  IF array_length(damage_ids, 1) >= 3 THEN damage_id_3 := damage_ids[3]; END IF;
  IF array_length(damage_ids, 1) >= 4 THEN damage_id_4 := damage_ids[4]; END IF;
  IF array_length(damage_ids, 1) >= 5 THEN damage_id_5 := damage_ids[5]; END IF;
  IF array_length(damage_ids, 1) >= 6 THEN damage_id_6 := damage_ids[6]; END IF;
  
  -- Scenario 1: Damage created and approved
  IF damage_id_1 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, created_by, created_at)
    VALUES 
      (damage_id_1, 'created', 'pending', 'Claims Agent', NOW() - INTERVAL '3 days'),
      (damage_id_1, 'approved', 'approved', 'Claims Adjuster', NOW() - INTERVAL '2 days');
  END IF;
  
  -- Scenario 2: Damage created, refused, then approved
  IF damage_id_2 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, refusal_reason, refusal_comment, created_by, created_at)
    VALUES 
      (damage_id_2, 'created', 'pending', NULL, NULL, 'Claims Agent', NOW() - INTERVAL '5 days'),
      (damage_id_2, 'refused', 'refused', 'Unclear Evidence', 'The photos provided are too blurry to assess the actual damage. Please upload clearer images showing the full extent of the damage.', 'Claims Adjuster', NOW() - INTERVAL '4 days'),
      (damage_id_2, 'approved', 'approved', NULL, NULL, 'Claims Adjuster', NOW() - INTERVAL '1 day');
  END IF;
  
  -- Scenario 3: Damage created and still pending
  IF damage_id_3 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, created_by, created_at)
    VALUES 
      (damage_id_3, 'created', 'pending', 'Claims Agent', NOW() - INTERVAL '1 day');
  END IF;
  
  -- Scenario 4: Damage created, refused with overblown estimation
  IF damage_id_4 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, refusal_reason, refusal_comment, created_by, created_at)
    VALUES 
      (damage_id_4, 'created', 'pending', NULL, NULL, 'Claims Agent', NOW() - INTERVAL '6 days'),
      (damage_id_4, 'refused', 'refused', 'Overblown Estimation', 'The estimated cost of $12,500 seems excessive for a minor scratch. Industry benchmarks suggest this type of damage should cost between $300-$800. Please revise the estimate.', 'Claims Adjuster', NOW() - INTERVAL '5 days'),
      (damage_id_4, 'approved', 'approved', NULL, NULL, 'Claims Adjuster', NOW() - INTERVAL '3 days');
  END IF;
  
  -- Scenario 5: Damage created, currently refused
  IF damage_id_5 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, refusal_reason, refusal_comment, created_by, created_at)
    VALUES 
      (damage_id_5, 'created', 'pending', NULL, NULL, 'Claims Agent', NOW() - INTERVAL '2 days'),
      (damage_id_5, 'refused', 'refused', 'Insufficient Documentation', 'Missing vehicle registration documents and incident report. Cannot proceed with claim assessment without proper documentation.', 'Claims Adjuster', NOW() - INTERVAL '12 hours');
  END IF;
  
  -- Scenario 6: Damage created, refused twice, then approved
  IF damage_id_6 IS NOT NULL THEN
    INSERT INTO public.damage_history (damage_id, event_type, status, refusal_reason, refusal_comment, created_by, created_at)
    VALUES 
      (damage_id_6, 'created', 'pending', NULL, NULL, 'Claims Agent', NOW() - INTERVAL '10 days'),
      (damage_id_6, 'refused', 'refused', 'Unclear Evidence', 'Photos do not show the full extent of damage. Need additional angles.', 'Claims Adjuster', NOW() - INTERVAL '9 days'),
      (damage_id_6, 'refused', 'refused', 'Overblown Estimation', 'After review of additional photos, the estimate still appears inflated. Market data suggests 40% lower cost.', 'Claims Adjuster', NOW() - INTERVAL '7 days'),
      (damage_id_6, 'approved', 'approved', NULL, NULL, 'Claims Adjuster', NOW() - INTERVAL '5 days');
  END IF;
  
END $$;

-- Update damages table status based on latest history
UPDATE public.damages d
SET status = (
  SELECT dh.status 
  FROM public.damage_history dh 
  WHERE dh.damage_id = d.id 
  ORDER BY dh.created_at DESC 
  LIMIT 1
);
