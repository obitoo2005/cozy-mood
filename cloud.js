/* ─────────────────────────────────────────────
   Cozy Mood · cloud sync (Supabase backend)
   credentials come from window.COZY_CONFIG (config.js)
   the user never sees URLs or keys.
   ───────────────────────────────────────────── */

window.Cloud = (() => {
  const AUTO_KEY = 'cozy-cloud-auto';
  const TABLE = 'cozy_mood_data';

  let client = null;
  let user = null;
  let lastSyncAt = null;
  let pushTimer = null;
  let pushing = false;

  function isConfigured() {
    const c = window.COZY_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  function isAutoSync() { return localStorage.getItem(AUTO_KEY) === '1'; }
  function setAutoSync(b) { localStorage.setItem(AUTO_KEY, b ? '1' : '0'); }

  async function init() {
    if (!isConfigured()) { client = null; user = null; return; }
    if (typeof window.supabase === 'undefined') {
      // library not yet loaded
      return;
    }
    if (client) return; // already initialised
    try {
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.COZY_CONFIG;
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
      });
      const { data } = await client.auth.getUser();
      user = data?.user || null;
      // listen for sign-in / sign-out across tabs
      client.auth.onAuthStateChange((_event, session) => {
        user = session?.user || null;
        if (window.refreshCloudUI) window.refreshCloudUI();
      });
    } catch (e) {
      console.warn('Cloud init failed:', e);
      client = null;
      user = null;
    }
  }

  async function signUp(email, password) {
    if (!client) await init();
    if (!client) return { error: { message: 'cloud not configured' } };
    const result = await client.auth.signUp({ email, password });
    if (!result.error) user = result.data.user;
    return result;
  }

  async function signIn(email, password) {
    if (!client) await init();
    if (!client) return { error: { message: 'cloud not configured' } };
    const result = await client.auth.signInWithPassword({ email, password });
    if (!result.error) user = result.data.user;
    return result;
  }

  async function signOut() {
    if (!client) return;
    try { await client.auth.signOut(); } catch (e) {}
    user = null;
  }

  async function push() {
    if (!client || !user) throw new Error('not signed in');
    if (pushing) return;
    pushing = true;
    try {
      const state = window.getCozyState ? window.getCozyState() : null;
      if (!state) throw new Error('no app state available');
      const { error } = await client.from(TABLE).upsert({
        user_id: user.id,
        state: state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      lastSyncAt = new Date();
    } finally {
      pushing = false;
    }
  }

  async function pull() {
    if (!client || !user) throw new Error('not signed in');
    const { data, error } = await client
      .from(TABLE)
      .select('state, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function scheduleSync() {
    if (!isAutoSync() || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try { await push(); if (window.refreshCloudUI) window.refreshCloudUI(); }
      catch (e) { console.warn('auto-sync failed', e); }
    }, 1500);
  }

  return {
    init,
    isConfigured,
    isAutoSync, setAutoSync,
    signUp, signIn, signOut,
    push, pull,
    scheduleSync,
    user: () => user,
    lastSyncAt: () => lastSyncAt,
    isReady: () => !!client,
    hasLib: () => typeof window.supabase !== 'undefined',
  };
})();
