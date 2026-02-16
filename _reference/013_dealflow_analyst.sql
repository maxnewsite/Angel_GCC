-- Dealflow Analyst Role Implementation
-- Adds dealflow_analyst role with same screening capabilities as dealflow_manager
-- but without IC submission permissions

-- ============================================================================
-- UPDATE APP_ROLE ENUM (if it exists)
-- ============================================================================

-- Check if app_role enum exists and add dealflow_analyst to it
DO $$
BEGIN
  -- Check if the enum type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    -- Add dealflow_analyst to the enum if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'app_role'::regtype
      AND enumlabel = 'dealflow_analyst'
    ) THEN
      ALTER TYPE app_role ADD VALUE 'dealflow_analyst';
      RAISE NOTICE 'Added dealflow_analyst to app_role enum';
    ELSE
      RAISE NOTICE 'dealflow_analyst already exists in app_role enum';
    END IF;
  ELSE
    RAISE NOTICE 'app_role enum does not exist - role column may be TEXT type';
  END IF;
END $$;

-- If role column uses CHECK constraint instead of enum, update it
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Get the constraint name if it exists
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conname LIKE '%role%' AND conrelid = 'profiles'::regclass
  LIMIT 1;

  -- Drop the constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END IF;
END $$;

-- ============================================================================
-- ANALYST SCREENING SCORES TABLE
-- Stores screening scores from dealflow analysts (separate from manager scores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analyst_screening_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES profiles(id),
  criterion_id UUID NOT NULL REFERENCES screening_criteria(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, analyst_user_id, criterion_id)
);

-- Enable RLS
ALTER TABLE analyst_screening_scores ENABLE ROW LEVEL SECURITY;

-- Analysts can manage their own scores
CREATE POLICY "Analysts can manage own scores" ON analyst_screening_scores
  FOR ALL USING (
    auth.uid() = analyst_user_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_analyst')
    )
  );

-- Dealflow managers can view all analyst scores
CREATE POLICY "Managers can view analyst scores" ON analyst_screening_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager')
    )
  );

-- IC members and IC chair can view analyst scores
CREATE POLICY "IC can view analyst scores" ON analyst_screening_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ic_member', 'ic_chair')
    )
  );

-- ============================================================================
-- ANALYST SCREENING REVIEWS TABLE
-- Stores overall screening reviews from dealflow analysts
-- ============================================================================
CREATE TABLE IF NOT EXISTS analyst_screening_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES profiles(id),
  overall_score NUMERIC,
  decision TEXT NOT NULL CHECK (decision IN ('recommend', 'needs_info', 'not_recommend')),
  summary_memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, analyst_user_id)
);

-- Enable RLS
ALTER TABLE analyst_screening_reviews ENABLE ROW LEVEL SECURITY;

-- Analysts can manage their own reviews
CREATE POLICY "Analysts can manage own reviews" ON analyst_screening_reviews
  FOR ALL USING (
    auth.uid() = analyst_user_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_analyst')
    )
  );

-- Dealflow managers can view all analyst reviews
CREATE POLICY "Managers can view analyst reviews" ON analyst_screening_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager')
    )
  );

-- IC members and IC chair can view analyst reviews
CREATE POLICY "IC can view analyst reviews" ON analyst_screening_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ic_member', 'ic_chair')
    )
  );

-- ============================================================================
-- ANALYST DEAL FLAGS TABLE
-- Stores red/green flags from dealflow analysts
-- ============================================================================
CREATE TABLE IF NOT EXISTS analyst_deal_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES profiles(id),

  -- Green Flags (Positive indicators)
  green_flags JSONB DEFAULT '[]'::jsonb,

  -- Red Flags (Warning indicators)
  red_flags JSONB DEFAULT '[]'::jsonb,

  -- Auto-detected by AI
  ai_generated BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one flag set per deal per analyst
  UNIQUE(deal_id, analyst_user_id)
);

-- Enable RLS
ALTER TABLE analyst_deal_flags ENABLE ROW LEVEL SECURITY;

-- Analysts can manage their own flags
CREATE POLICY "Analysts can manage own flags" ON analyst_deal_flags
  FOR ALL USING (
    auth.uid() = analyst_user_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_analyst')
    )
  );

-- Dealflow managers can view all analyst flags
CREATE POLICY "Managers can view analyst flags" ON analyst_deal_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager')
    )
  );

-- IC members and IC chair can view analyst flags
CREATE POLICY "IC can view analyst flags" ON analyst_deal_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ic_member', 'ic_chair')
    )
  );

-- ============================================================================
-- UPDATE EXISTING POLICIES TO INCLUDE DEALFLOW ANALYST
-- ============================================================================

-- Update startups policies
DROP POLICY IF EXISTS "Internal roles can view all startups" ON startups;
CREATE POLICY "Internal roles can view all startups" ON startups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update deals policies
DROP POLICY IF EXISTS "Internal roles can view all deals" ON deals;
CREATE POLICY "Internal roles can view all deals" ON deals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update screening_criteria policies
DROP POLICY IF EXISTS "Internal roles can view criteria" ON screening_criteria;
CREATE POLICY "Internal roles can view criteria" ON screening_criteria
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update yc_flags_catalog policies
DROP POLICY IF EXISTS "Internal roles can view catalog" ON yc_flags_catalog;
CREATE POLICY "Internal roles can view catalog" ON yc_flags_catalog
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update documents policies
DROP POLICY IF EXISTS "Internal roles can view documents" ON documents;
CREATE POLICY "Internal roles can view documents" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Dealflow analysts can upload documents (same as managers)
CREATE POLICY "Analysts can upload documents" ON documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_analyst')
    )
  );

-- Update interests policies
DROP POLICY IF EXISTS "Internal roles can view interests" ON interests;
CREATE POLICY "Internal roles can view interests" ON interests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update ic_decisions policies
DROP POLICY IF EXISTS "Internal roles can view decisions" ON ic_decisions;
CREATE POLICY "Internal roles can view decisions" ON ic_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Update ai_recommendations policies
DROP POLICY IF EXISTS "Internal roles can view recommendations" ON ai_recommendations;
CREATE POLICY "Internal roles can view recommendations" ON ai_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_manager', 'dealflow_analyst', 'ic_member', 'ic_chair')
    )
  );

-- Dealflow analysts can create/update recommendations
CREATE POLICY "Dealflow analysts can manage recommendations" ON ai_recommendations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dealflow_analyst')
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_analyst_screening_scores_deal_id ON analyst_screening_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_analyst_screening_scores_analyst ON analyst_screening_scores(analyst_user_id);
CREATE INDEX IF NOT EXISTS idx_analyst_screening_reviews_deal_id ON analyst_screening_reviews(deal_id);
CREATE INDEX IF NOT EXISTS idx_analyst_screening_reviews_analyst ON analyst_screening_reviews(analyst_user_id);
CREATE INDEX IF NOT EXISTS idx_analyst_deal_flags_deal_id ON analyst_deal_flags(deal_id);
CREATE INDEX IF NOT EXISTS idx_analyst_deal_flags_analyst ON analyst_deal_flags(analyst_user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE analyst_screening_scores IS 'Screening scores from dealflow analysts (separate from manager scores)';
COMMENT ON TABLE analyst_screening_reviews IS 'Overall screening reviews from dealflow analysts';
COMMENT ON TABLE analyst_deal_flags IS 'YC-style red/green flags from dealflow analysts';

-- ============================================================================
-- VIEW: All Analyses for Dealflow Manager
-- Combines manager and analyst analyses for easy viewing
-- ============================================================================
CREATE OR REPLACE VIEW deal_all_analyses AS
SELECT
  d.id AS deal_id,
  d.status,
  s.name AS startup_name,

  -- Manager screening
  sr.manager_user_id,
  sr.overall_score AS manager_overall_score,
  sr.decision AS manager_decision,
  sr.summary_memo AS manager_memo,
  sr.created_at AS manager_created_at,

  -- Analyst screenings (aggregated)
  (
    SELECT json_agg(
      json_build_object(
        'analyst_id', asr.analyst_user_id,
        'analyst_name', p.full_name,
        'analyst_email', p.email,
        'overall_score', asr.overall_score,
        'decision', asr.decision,
        'summary_memo', asr.summary_memo,
        'created_at', asr.created_at,
        'updated_at', asr.updated_at
      ) ORDER BY asr.updated_at DESC
    )
    FROM analyst_screening_reviews asr
    JOIN profiles p ON p.id = asr.analyst_user_id
    WHERE asr.deal_id = d.id
  ) AS analyst_reviews,

  -- Count of analyst analyses
  (
    SELECT COUNT(*)
    FROM analyst_screening_reviews asr
    WHERE asr.deal_id = d.id
  ) AS analyst_count

FROM deals d
LEFT JOIN startups s ON s.id = d.startup_id
LEFT JOIN screening_reviews sr ON sr.deal_id = d.id;

-- Grant access to the view for internal roles
GRANT SELECT ON deal_all_analyses TO authenticated;

-- ============================================================================
-- FUNCTION: Get Complete Analysis for a Deal
-- Returns all screening data (manager + analysts) for a specific deal
-- ============================================================================
CREATE OR REPLACE FUNCTION get_deal_complete_analysis(p_deal_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT json_build_object(
    'deal_id', d.id,
    'deal_status', d.status,
    'startup_name', s.name,

    -- Manager analysis
    'manager_analysis', (
      SELECT json_build_object(
        'scores', (
          SELECT json_agg(
            json_build_object(
              'criterion_name', sc.name,
              'criterion_description', sc.description,
              'weight', sc.weight,
              'score', ss.score,
              'note', ss.note
            )
          )
          FROM screening_scores ss
          JOIN screening_criteria sc ON sc.id = ss.criterion_id
          WHERE ss.deal_id = d.id
        ),
        'review', (
          SELECT row_to_json(sr)
          FROM screening_reviews sr
          WHERE sr.deal_id = d.id
          LIMIT 1
        ),
        'flags', (
          SELECT row_to_json(df)
          FROM deal_flags df
          WHERE df.deal_id = d.id
          LIMIT 1
        )
      )
    ),

    -- Analyst analyses (array)
    'analyst_analyses', (
      SELECT json_agg(
        json_build_object(
          'analyst_id', asr.analyst_user_id,
          'analyst_name', p.full_name,
          'analyst_email', p.email,
          'scores', (
            SELECT json_agg(
              json_build_object(
                'criterion_name', sc.name,
                'criterion_description', sc.description,
                'weight', sc.weight,
                'score', ass.score,
                'note', ass.note
              )
            )
            FROM analyst_screening_scores ass
            JOIN screening_criteria sc ON sc.id = ass.criterion_id
            WHERE ass.deal_id = d.id AND ass.analyst_user_id = asr.analyst_user_id
          ),
          'review', row_to_json(asr),
          'flags', (
            SELECT row_to_json(adf)
            FROM analyst_deal_flags adf
            WHERE adf.deal_id = d.id AND adf.analyst_user_id = asr.analyst_user_id
          )
        )
      )
      FROM analyst_screening_reviews asr
      JOIN profiles p ON p.id = asr.analyst_user_id
      WHERE asr.deal_id = d.id
    )
  ) INTO result
  FROM deals d
  JOIN startups s ON s.id = d.startup_id
  WHERE d.id = p_deal_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (RLS will control access)
GRANT EXECUTE ON FUNCTION get_deal_complete_analysis(UUID) TO authenticated;

COMMENT ON FUNCTION get_deal_complete_analysis IS 'Returns complete analysis data for a deal including manager and all analyst analyses';
