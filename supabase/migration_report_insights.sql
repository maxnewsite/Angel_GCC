-- Migration: richer screening reports
-- Run this in Supabase SQL Editor if the database already exists.
-- Stores key strengths, risks, due-diligence questions, deck metadata and
-- per-step warnings produced by the analysis pipeline.

ALTER TABLE analysis_reports
  ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '{}';
