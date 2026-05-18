/* ─────────────────────────────────────────────
   Cozy Mood · backend config
   This file holds the Supabase credentials.
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your own
   project's values from Project Settings → API.
   The anon key is safe to ship to the frontend — Row-Level
   Security policies (set in setup.sql) protect user data.
   ───────────────────────────────────────────── */

window.COZY_CONFIG = {
  SUPABASE_URL: 'https://feynlmiytcdsoywsqvup.supabase.co',          // e.g. 'https://xxxxxxxx.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleW5sbWl5dGNkc295d3NxdnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTczMDYsImV4cCI6MjA5NDU5MzMwNn0.Pd_fHtXBI1C1dbNpQ0avGi-8aIiP-dmMAGwzmfG1AC0',     // anon public key (long JWT-looking string)
};
