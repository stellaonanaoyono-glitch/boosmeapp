-- ══════════════════════════════════════════════
-- BOOST.ME — Schéma Supabase complet
-- À exécuter dans Supabase > SQL Editor
-- ══════════════════════════════════════════════

-- 1. PROFILES (complète auth.users)
create table if not exists public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  prenom          text not null,
  nom             text,
  pays            text,
  langue          text default 'fr',
  age_range       text,
  situation_pro   text,
  disponibilite   text,
  objectif        text,
  plan            text default 'free',
  plan_expires_at timestamptz,
  ref_code        text unique,
  referred_by     text,
  bonus_months    int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2. CHALLENGES (catalogue)
create table if not exists public.challenges (
  id          text primary key,
  name        text not null,
  category    text,
  emoji       text,
  tagline     text,
  description text,
  duration    int default 30,
  price_eur   decimal(6,2) default 3.99,
  is_free     boolean default false,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- 3. USER_CHALLENGES (progression par challenge)
create table if not exists public.user_challenges (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  challenge_id text references public.challenges(id),
  current_day  int default 1,
  streak       int default 0,
  best_streak  int default 0,
  points       int default 0,
  status       text default 'active', -- active | completed | paused
  started_at   timestamptz default now(),
  last_active  timestamptz default now(),
  completed_at timestamptz,
  unique(user_id, challenge_id)
);

-- 4. DAILY_VALIDATIONS (jours validés)
create table if not exists public.daily_validations (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  challenge_id text references public.challenges(id),
  day_number   int not null,
  reflection   text,
  validated_at timestamptz default now(),
  unique(user_id, challenge_id, day_number)
);

-- 5. DAILY_CONTENT (contenu IA généré et sauvegardé)
create table if not exists public.daily_content (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  challenge_id text references public.challenges(id),
  day_number   int not null,
  lesson_title text,
  lesson_body  text,
  action_title text,
  action_body  text,
  question     text,
  generated_at timestamptz default now(),
  unique(user_id, challenge_id, day_number)
);

-- 6. PROMO_CODES
create table if not exists public.promo_codes (
  code          text primary key,
  type          text not null, -- 'percent' | 'fixed'
  value         decimal(6,2) not null,
  label         text,
  active        boolean default true,
  usage_limit   int,
  used_count    int default 0,
  expires_at    timestamptz,
  created_at    timestamptz default now()
);

-- 7. REFERRAL_CODES
create table if not exists public.referral_codes (
  code                text primary key,
  owner_id            uuid references public.profiles(id) on delete cascade,
  used_count          int default 0,
  bonus_months_earned int default 0,
  created_at          timestamptz default now()
);

-- 8. PAYMENTS
create table if not exists public.payments (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id),
  plan           text not null,
  amount_eur     decimal(6,2),
  currency       text default 'EUR',
  provider       text, -- 'stripe' | 'notchpay'
  provider_ref   text unique,
  promo_code     text,
  ref_code_used  text,
  status         text default 'pending', -- pending | confirmed | failed
  created_at     timestamptz default now(),
  confirmed_at   timestamptz
);

-- ══════════════════════════════════════════════
-- SEED — Challenges catalogue
-- ══════════════════════════════════════════════
insert into public.challenges (id, name, category, emoji, tagline, duration, price_eur, is_free) values
  ('boostme-starter',         'BoostMe Starter',         'Multi-piliers', '⚡', '7 jours. Une première victoire.',              7,  0.00, true),
  ('cash-clarity',            'Cash Clarity',            'Money',         '💰', 'Reprends le contrôle de ton argent.',          30, 3.99, false),
  ('glow-up',                 'Glow Up',                 'Mind',          '✨', 'Deviens la femme que tu regardes de loin.',    30, 3.99, false),
  ('mental-detox',            'Mental Detox',            'Mind',          '🧠', 'Reprends le contrôle de ton esprit.',          30, 3.99, false),
  ('morning-power',           'Morning Power',           'Performance',   '🌅', 'Celui qui possède ses matins possède sa vie.', 30, 3.99, false),
  ('unshakeable-confidence',  'Unshakeable Confidence',  'Mind',          '💪', 'La confiance ne se trouve pas. Elle se construit.', 30, 3.99, false),
  ('body-reset',              'Body Reset',              'Performance',   '💚', 'Ton corps est ton premier outil de performance.', 30, 3.99, false),
  ('build-your-brand',        'Build Your Brand',        'Carrière',      '🚀', 'Tu existes déjà. Il est temps que le monde le sache.', 30, 3.99, false),
  ('side-hustle-starter',     'Side Hustle Starter',     'Money',         '💡', 'Tu as déjà ce qu il faut pour gagner plus.',   30, 3.99, false),
  ('own-the-room',            'Own The Room',            'Carrière',      '🎤', 'Prendre la parole avec impact.',               30, 3.99, false),
  ('deep-work-mode',          'Deep Work Mode',          'Performance',   '🎯', 'Tu produis 3x plus en moins de temps.',        30, 3.99, false),
  ('network-like-a-pro',      'Network Like a Pro',      'Carrière',      '🤝', 'Ton réseau est ton tremplin.',                 30, 3.99, false),
  ('read-and-lead',           'Read & Lead',             'Performance',   '📖', 'Tu lis pour changer, pas pour savoir.',        30, 3.99, false)
on conflict (id) do nothing;

-- Seed promo codes
insert into public.promo_codes (code, type, value, label, usage_limit) values
  ('LAUNCH30',  'percent', 30,  '-30%',        100),
  ('BIENVENUE', 'percent', 20,  '-20%',        500),
  ('MOITIE50',  'percent', 50,  '-50%',         50),
  ('GRATUIT',   'percent', 100, '100% gratuit', 10),
  ('MINUS10',   'fixed',   10,  '-€10',         50),
  ('AFRICA25',  'percent', 25,  '-25%',        200)
on conflict (code) do nothing;

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════
alter table public.profiles          enable row level security;
alter table public.user_challenges   enable row level security;
alter table public.daily_validations enable row level security;
alter table public.daily_content     enable row level security;
alter table public.payments          enable row level security;
alter table public.referral_codes    enable row level security;
alter table public.challenges        enable row level security;
alter table public.promo_codes       enable row level security;

-- Policies : chaque user ne voit que ses données
create policy "profiles: own data" on public.profiles
  for all using (auth.uid() = id);

create policy "user_challenges: own data" on public.user_challenges
  for all using (auth.uid() = user_id);

create policy "daily_validations: own data" on public.daily_validations
  for all using (auth.uid() = user_id);

create policy "daily_content: own data" on public.daily_content
  for all using (auth.uid() = user_id);

create policy "payments: own data" on public.payments
  for all using (auth.uid() = user_id);

create policy "referral_codes: own data" on public.referral_codes
  for all using (auth.uid() = owner_id);

-- Challenges et promo_codes sont lisibles par tous les users authentifiés
create policy "challenges: read all" on public.challenges
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "promo_codes: read active" on public.promo_codes
  for select using (active = true);

-- ══════════════════════════════════════════════
-- FUNCTION : auto-créer le profil après signup
-- ══════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger as $$
declare
  ref_code_val text;
begin
  -- Générer un code parrainage unique
  ref_code_val := upper(substring(new.id::text, 1, 8));
  
  insert into public.profiles (id, prenom, pays, ref_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'prenom', 'Membre'),
    coalesce(new.raw_user_meta_data->>'pays', 'FR'),
    ref_code_val
  );
  
  -- Créer l'entrée referral_codes
  insert into public.referral_codes (code, owner_id)
  values (ref_code_val, new.id)
  on conflict (code) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger sur auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ══════════════════════════════════════════════
-- FUNCTION : mettre à jour updated_at auto
-- ══════════════════════════════════════════════
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();
