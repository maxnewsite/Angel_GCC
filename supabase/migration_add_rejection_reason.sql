-- Migration: add rejection_reason column to submissions
-- Run this in Supabase SQL Editor if the database already exists

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
