-- ============================================================
-- BOOST.ME — Supabase Migrations
-- Colle ce fichier entier dans Supabase > SQL Editor > Run
-- ============================================================

-- ── 1. Journal des entrées utilisateur ──────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users NOT NULL,
  text         text        NOT NULL,
  mood         text,
  mood_ico     text,
  tags         text[],
  ai_insight   text,
  ai_action    text,
  ai_challenges text[],
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_user" ON journal_entries;
CREATE POLICY "journal_user" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user
  ON journal_entries(user_id, created_at DESC);

-- ── 2. Colonnes manquantes dans profiles ────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_reminders  boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at  timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ref_code         text;

-- ── 3. Certificats ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificats (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES auth.users NOT NULL,
  challenge_id    text        NOT NULL,
  challenge_name  text,
  days_completed  int,
  final_streak    int,
  completed_at    timestamptz DEFAULT now(),
  cert_number     text,
  UNIQUE(user_id, challenge_id)
);
ALTER TABLE certificats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cert_user" ON certificats;
CREATE POLICY "cert_user" ON certificats
  FOR ALL USING (auth.uid() = user_id);

-- ── 4. Colonnes manquantes dans payments ────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS challenge_id  text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_xaf    int;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at  timestamptz;

-- ── 5. Bucket avatars (Supabase Storage) ────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_upload"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_delete"  ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 6. RLS sur profiles ─────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── 7. daily_validations (pour les stats) ───────────────────
CREATE TABLE IF NOT EXISTS daily_validations (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users NOT NULL,
  challenge_id text        NOT NULL,
  day_number   int         NOT NULL,
  reflection   text,
  validated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_id, day_number)
);
ALTER TABLE daily_validations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "validations_user" ON daily_validations;
CREATE POLICY "validations_user" ON daily_validations
  FOR ALL USING (auth.uid() = user_id);

-- ── 8. user_challenges (si pas déjà créée) ──────────────────
CREATE TABLE IF NOT EXISTS user_challenges (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users NOT NULL,
  challenge_id text        NOT NULL,
  current_day  int         DEFAULT 1,
  status       text        DEFAULT 'active',
  streak       int         DEFAULT 0,
  last_active  timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(user_id, challenge_id)
);
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uc_user" ON user_challenges;
CREATE POLICY "uc_user" ON user_challenges
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_uc_user_status
  ON user_challenges(user_id, status, last_active DESC);

-- ── 9. daily_content cache (pour challenge-day) ─────────────
CREATE TABLE IF NOT EXISTS daily_content (
  id           uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid  REFERENCES auth.users NOT NULL,
  challenge_id text  NOT NULL,
  day_number   int   NOT NULL,
  day_title    text,
  lesson_title text,
  lesson_body  text,
  action_title text,
  action_body  text,
  action_objective text,
  booster      text,
  question     text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_id, day_number)
);
ALTER TABLE daily_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dc_user" ON daily_content;
CREATE POLICY "dc_user" ON daily_content
  FOR ALL USING (auth.uid() = user_id);

-- ── Fin ──────────────────────────────────────────────────────
-- Vérifie dans Table Editor que ces tables existent :
-- profiles, user_challenges, daily_content, daily_validations,
-- journal_entries, certificats, payments
-- Et dans Storage : bucket "avatars" public

-- ── 10. pending_payments (pour liens de paiement NotchPay) ──
CREATE TABLE IF NOT EXISTS pending_payments (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users NOT NULL UNIQUE,
  plan         text        NOT NULL,
  challenge_id text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_user" ON pending_payments;
CREATE POLICY "pp_user" ON pending_payments
  FOR ALL USING (auth.uid() = user_id);
