# 🌷 Cozy Mood Tracker

A pastel cute monthly mood + habit + self-care tracker. Mobile-friendly, works offline, syncs across devices, installable as a phone app.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```bash
python -m http.server 5500
# open http://localhost:5500
```

## Features

- 📅 Monthly calendar with mood per day, click any cell to edit
- 🌷 12 hand-drawn animal mood stickers + custom emoji stickers
- ✿ Habit tracker with checkmarks, crosses, and streak counter
- 💪 Health: water, sleep, steps, calories, meals, productivity stars
- 📝 Daily todos + future reminders
- 📖 Journal entries with "special day" toggle
- 📊 Stats: mood graph, habit consistency, weekly recap, monthly summary
- 🗂️ Full archive of past months
- 🔎 Search across notes, journals, todos, moods
- 🎨 5 pastel themes + dark mode
- 🔔 Daily reminders via browser notifications
- 💾 Local storage + JSON export/import + monthly markdown report
- ☁️ Optional cloud sync via Supabase
- 📱 Install as a phone app (PWA) or download the APK

## Deploy to GitHub Pages

The repo includes `.github/workflows/deploy-pages.yml`. Just push to `main`:

1. Push the project to a GitHub repo
2. Repo Settings → Pages → Source: **GitHub Actions**
3. Push to `main` — the workflow deploys automatically
4. Site goes live at `https://<username>.github.io/<repo>/`

## Build & release the Android APK

The repo includes `.github/workflows/build-apk.yml`. To cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will:
1. Build a signed APK with Google's Bubblewrap (Trusted Web Activity wrapper)
2. Extract the APK's SHA-256 fingerprint
3. Generate `.well-known/assetlinks.json` and commit it back to `main`
4. Create a GitHub Release with `cozy-mood.apk` attached

The `assetlinks.json` file is what tells Android "this APK and this website are the same author" — once published, the URL bar at the top of the app disappears and it looks fully native. ✨

Users download from your repo's **Releases** page → install on Android.

### About the keystore (important!)

By default, the workflow generates a **new keystore on every build** which means a new SHA-256 fingerprint each time. That's fine for testing, but every new APK will be treated as a different app by Android — users would need to uninstall and reinstall.

For stable releases, generate a keystore once locally and store it as a GitHub repo secret:

```bash
# Generate a stable keystore (do this ONCE, keep the file safe)
keytool -genkey -v -keystore android.keystore -alias cozy \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_PASSWORD -keypass YOUR_PASSWORD \
  -dname "CN=Cozy Mood, OU=App, O=Cozy, L=Earth, S=Earth, C=US"

# Encode it for GitHub
base64 -w 0 android.keystore > keystore.b64       # Linux/macOS
# or on Windows PowerShell:
# [Convert]::ToBase64String([IO.File]::ReadAllBytes('android.keystore')) > keystore.b64
```

Then in your GitHub repo → Settings → Secrets and variables → Actions → New repo secret:

| name | value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | your keystore password |
| `ANDROID_KEY_PASSWORD` | your key password (usually same as above) |
| `ANDROID_KEY_ALIAS` | `cozy` (or whatever alias you used) |

Now every build uses the same keystore → same fingerprint → users update in place like a normal app.

### Full release flow (recommended)

1. Push project to GitHub, enable Pages (Settings → Pages → Source: GitHub Actions)
2. Create + add the keystore secrets above (one-time)
3. `git tag v1.0.0 && git push origin v1.0.0`
4. Wait for build, download APK from Releases page
5. Test installing on Android — the URL bar should be hidden ✨

## Optional: cloud sync setup (developer)

1. Sign up free at [supabase.com](https://supabase.com) → create a new project
2. SQL Editor → run `setup.sql` (creates the `cozy_mood_data` table + row-level security)
3. Project Settings → API → copy **Project URL** and **anon public key**
4. Open `config.js` and paste them in:
   ```js
   window.COZY_CONFIG = {
     SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOiJI...'
   };
   ```
5. Commit + push. The Cloud Sync card in Settings will appear for users.

If `config.js` is left empty, the cloud sync card stays hidden and the app works in local-only mode.

## Project structure

```
.
├── index.html
├── styles.css
├── app.js
├── cloud.js                    optional Supabase sync
├── config.js                   developer credentials
├── setup.sql                   one-time Supabase setup
├── manifest.webmanifest        PWA metadata
├── sw.js                       service worker (offline cache)
├── favicon.ico
├── README.md
├── .gitignore
├── .github/workflows/
│   ├── deploy-pages.yml        auto-deploy to GitHub Pages
│   └── build-apk.yml           build APK on git tag push
├── assets/
│   ├── mascot.png
│   ├── icons/                  PWA + Android icons
│   ├── moods/                  12 stickers
│   ├── deco/                   flower / star / heart / cloud
│   ├── tabs/                   7 tab icons
│   └── header/                 5 header icons
└── (slicer scripts: optional, regenerate art)
    ├── slice_moods.py
    ├── slice_everything.py
    ├── slice_header.py
    └── generate_icons.py
```

## Storage

Data lives in your browser's `localStorage` (private, on-device). For multi-device, sign in to cloud sync. Always have a JSON backup via Settings → Export.
