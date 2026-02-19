-- ============================================
-- Angel AI Analyst - Complete Database Schema
-- ============================================
-- Run this in Supabase SQL Editor after creating a new project

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'founder' CHECK (role IN ('founder', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES profiles(id),
  startup_name TEXT NOT NULL,
  website TEXT,
  sector TEXT,
  hq_location TEXT,
  description TEXT,
  founding_date TEXT,
  team_info TEXT,
  traction_info TEXT,
  business_model TEXT,
  funding_ask TEXT,
  use_of_funds TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_review', 'analyzing', 'completed', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can insert own submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = founder_id);

CREATE POLICY "Founders can read own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = founder_id);

CREATE POLICY "Founders can update own submitted submissions"
  ON submissions FOR UPDATE
  USING (auth.uid() = founder_id AND status = 'submitted');

CREATE POLICY "Admin can read all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update all submissions"
  ON submissions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pitch_deck', 'financials', 'other')),
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can insert docs for own submissions"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND founder_id = auth.uid())
  );

CREATE POLICY "Founders can read own docs"
  ON documents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND founder_id = auth.uid())
  );

CREATE POLICY "Admin can read all docs"
  ON documents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. ANALYSIS REPORTS TABLE
CREATE TABLE IF NOT EXISTS analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  recommendation TEXT,
  executive_summary TEXT,
  criteria_scores JSONB NOT NULL DEFAULT '[]',
  green_flags JSONB NOT NULL DEFAULT '[]',
  red_flags JSONB NOT NULL DEFAULT '[]',
  market_research JSONB DEFAULT '{}',
  detailed_rationale TEXT,
  raw_ai_responses JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage reports"
  ON analysis_reports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Founders can read own completed reports"
  ON analysis_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = analysis_reports.submission_id
        AND submissions.founder_id = auth.uid()
        AND submissions.status = 'completed'
    )
  );

-- 5. INDEXES
CREATE INDEX idx_submissions_founder_id ON submissions(founder_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_documents_submission_id ON documents(submission_id);
CREATE INDEX idx_analysis_reports_submission_id ON analysis_reports(submission_id);

-- 6. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'founder'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. SEED ADMIN PROFILE (admin user already created via Auth API)
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Admin', 'admin'
FROM auth.users
WHERE email = 'spiridione@hotmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Admin';

-- 8. STORAGE POLICIES (bucket 'submissions' already created via API)
CREATE POLICY "Anyone authenticated can upload to submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'submissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can read submissions files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions' AND auth.uid() IS NOT NULL);
