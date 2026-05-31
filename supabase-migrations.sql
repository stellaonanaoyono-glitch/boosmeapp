-- Run this in Supabase SQL Editor

-- 1. Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  text text NOT NULL,
  mood text,
  mood_ico text,
  tags text[],
  ai_insight text,
  ai_action text,
  ai_challenges text[],
  created_at timestamptz DEFAULT now()
);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_user" ON journal_entries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, created_at DESC);

-- 2. Add avatar_url and email_reminders to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_reminders boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

-- 3. Certificats table (if not exists)
CREATE TABLE IF NOT EXISTS certificats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  challenge_id text NOT NULL,
  challenge_name text,
  days_completed int,
  final_streak int,
  completed_at timestamptz DEFAULT now(),
  cert_number text,
  UNIQUE(user_id, challenge_id)
);
ALTER TABLE certificats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_user" ON certificats FOR ALL USING (auth.uid() = user_id);

-- 4. Payments table: add missing columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS challenge_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_xaf int;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 5. Supabase Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Email reminders opt-out: allow users to update their own preference
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
