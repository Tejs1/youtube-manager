# YouTube Companion Dashboard

Live: https://youtube-manager-rouge.vercel.app

Mini-dashboard built with the T3 stack + shadcn/ui to manage a YouTube video: view details, manage comments, edit title/description, keep private notes, and capture event logs.

## Setup

1) Create a Google Cloud OAuth client (Web) and enable the YouTube Data API v3 for your project.
- Authorized redirect URI: `/api/auth/callback/google`
- Scopes used: `openid email profile https://www.googleapis.com/auth/youtube.force-ssl`

2) Environment variables (`.env`):
- `AUTH_SECRET` — `npx auth secret`
- `AUTH_GOOGLE_ID` — Google OAuth Client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth Client Secret
- `DATABASE_URL` — Postgres connection URL

3) Database
- Generate/push schema with Drizzle (`pnpm run db:push` or `bun run db:push`).

4) Dev
- `pnpm dev` (or `bun dev` / `npm run dev`)

## API Endpoints (tRPC procedures)

All endpoints are authenticated unless noted. They are exposed via tRPC under `/api/trpc`.

- youtube.fetchVideo
  - Input: `{ videoId: string }`
  - Returns one Video resource (snippet, statistics, contentDetails, status)
- youtube.listComments
  - Input: `{ videoId: string }`
  - Returns commentThreads with top-level comments and replies
- youtube.addComment
  - Input: `{ videoId: string, text: string }`
  - Inserts a top-level comment on the video
- youtube.replyToComment
  - Input: `{ parentId: string, text: string }`
  - Replies to an existing top-level comment
- youtube.deleteComment
  - Input: `{ commentId: string }`
  - Deletes a comment (must be authored by the authenticated channel)
- youtube.updateVideo
  - Input: `{ videoId: string, title?: string, description?: string }`
  - Updates video snippet fields (title/description). Preserves other snippet fields.
- notes.get
  - Input: `{ videoId: string }`
  - Returns a single note entry for the current user + video (if exists)
- notes.upsert
  - Input: `{ videoId: string, content: string }`
  - Creates/updates the note for the current user + video
- notes.delete
  - Input: `{ videoId: string }`
  - Deletes the note for the current user + video

Event logs are captured automatically for all above actions.

## Database Schema (Drizzle)

Tables added on top of NextAuth defaults:

- notes (`youtube-manager_note`)
  - `id` integer PK
  - `userId` varchar FK -> user.id
  - `videoId` varchar(64)
  - `content` text
  - `createdAt` timestamptz default now
  - `updatedAt` timestamptz on update

- event_logs (`youtube-manager_event_log`)
  - `id` integer PK
  - `userId` varchar FK -> user.id (nullable)
  - `action` varchar(128)
  - `videoId` varchar(64) (nullable)
  - `targetType` varchar(64) (nullable)
  - `targetId` varchar(128) (nullable)
  - `status` varchar(16) default 'success'
  - `message` text (nullable)
  - `metadata` json (nullable)
  - `createdAt` timestamptz default now

Auth/Accounts tables are provided by NextAuth + Drizzle adapter.

## Theming

Brand-forward theming is configured with shadcn/ui using a YouTube-inspired red accent. See `src/styles/globals.css` for CSS variables (light/dark). UI components live under `src/components/ui/*`.
