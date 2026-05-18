-- Cozy Mood Tracker · Supabase setup
-- Run this once in your Supabase SQL Editor.
-- Project Settings → SQL Editor → New query → paste → Run.

create table if not exists cozy_mood_data (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null,
  updated_at timestamptz default now()
);

alter table cozy_mood_data enable row level security;

-- users can only access their own row
create policy "users read own"   on cozy_mood_data for select using (auth.uid() = user_id);
create policy "users insert own" on cozy_mood_data for insert with check (auth.uid() = user_id);
create policy "users update own" on cozy_mood_data for update using (auth.uid() = user_id);
create policy "users delete own" on cozy_mood_data for delete using (auth.uid() = user_id);
