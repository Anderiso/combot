# Ad Concept Research Tool

A Next.js web app for storing up to 100 competitor ad videos (per funnel stage), transcribing them with Whisper, and randomly mixing TOF/MOF/BOF concepts for creative research.

## Stack

- **Next.js** (App Router, TypeScript)
- **Supabase** (Postgres + Storage)
- **OpenAI Whisper** for transcription
- **ffmpeg-static** + fluent-ffmpeg for server-side audio extraction
- **Anthropic** for concept remixing (scaffolded)
- **Tailwind CSS**
- Deploy target: **Vercel**

## Setup

### 1. Install dependencies

```bash
npm install
```

No separate ffmpeg install is required — `ffmpeg-static` bundles the binary for local dev and Vercel.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (client uploads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server API routes only) |
| `OPENAI_API_KEY` | For Whisper transcription |
| `ANTHROPIC_API_KEY` | For remix feature |

### 3. Database

The `concepts` and `brand_profile` tables are created via Supabase migration. Storage bucket `videos` should be **public** (already provisioned).

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Randomizer — pick one random TOF, MOF, BOF concept |
| `/load` | Upload MP4, transcribe, save concept |
| `/library` | Browse all concepts by funnel stage |
| `/library/[id]` | Concept detail + remix button |
| `/brand` | Edit brand profile for remix prompts |

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all environment variables from `.env.example` in the Vercel project settings.
4. Deploy.

`ffmpeg-static` is listed in `serverExternalPackages` in `next.config.ts` so the bundled ffmpeg binary works on Vercel serverless functions. The transcribe route has a 60s timeout via `vercel.json`.

## Upload flow

1. **Select MP4** and click **Transcribe**.
   - Files **over 24 MB** → audio is extracted first (stays under Whisper's 25 MB limit).
   - Files **24 MB or under** → video is sent directly to Whisper.
2. **Verify the script** — shown at the top; edit if needed.
3. **Title + description** — metadata below the script.
4. **Funnel stage** — pick TOF / MOF / BOF manually, or click **Get AI recommendation** for Anthropic's suggestion + explanation (optional **Apply**).
5. **Save to library** — auto-assigns the next open slot, uploads the MP4 (max **100 MB**), stores everything.

### Video size limit

Library uploads are capped at **200 MB** per file. The `videos` storage bucket is configured for this limit.

Supabase also enforces a **global** file size limit in **Storage → Settings** (separate from the bucket). If uploads fail below 200 MB, that global limit is likely still at the default **50 MB**. On Pro+, raise it here:

https://supabase.com/dashboard/project/skzykljbkqnjwbmrlhvd/storage/settings

## Concept slots

- **Funnel stages:** TOF, MOF, BOF
- **Numbers:** 1–100 per stage (unique per stage)
- Up to 300 concepts total across all stages
