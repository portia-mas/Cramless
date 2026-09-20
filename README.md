# Cramless

Cramless is a system-integration project that connects a student's assignment list with their **Google Calendar** via the Calendar API. It finds real free time before each deadline, automatically schedules study blocks into the calendar, and flags any assignment that doesn't have enough free time left before it's due.

## Problem

Students track deadlines in one place (an LMS, a notebook, memory) and their actual free time in another (their calendar), and rarely reconcile the two until it's too late — leading to last-minute cramming or missed work that could've been avoided with earlier visibility. Cramless surfaces that reconciliation automatically instead of leaving it to the student to notice on their own.

## How it works

1. Add assignments (title, due date, estimated hours of work needed).
2. Connect your Google Calendar (OAuth2).
3. Click **Sync** — Cramless reads your existing calendar events, computes genuinely free slots between now and each deadline, greedily allocates study time to the earliest deadlines first, writes "Study: <assignment>" blocks directly into your calendar, and flags any assignment it couldn't fully fit in before its due date.

## Tech stack

- Node.js + Express
- Google Calendar API (OAuth2, via `googleapis`)
- Vanilla HTML/CSS/JS frontend (no framework, kept deliberately simple for this scope)
- JSON file storage for assignments (no DB needed at this stage)

## Setup

1. **Create Google OAuth credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
   - Create an OAuth 2.0 Client ID (Web application)
   - Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI
   - Enable the **Google Calendar API** for the project

2. **Configure environment**
   ```bash
   cp .env.local .env
   # fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   ```

3. **Install and run**
   ```bash
   npm install
   npm start
   ```

4. Open `http://localhost:3000`, connect your calendar, add a few assignments, hit sync.

## Current scope (MVP)

- Manual assignment entry (title, due date, hours needed)
- Single calendar (primary) read/write
- Greedy earliest-deadline-first scheduling within working hours (default 9am–10pm, configurable via `.env`)

## Planned next (post-assignment roadmap)

- Pull assignments directly from an LMS (Canvas/Moodle API) instead of manual entry
- Smarter scheduling: weight by task difficulty/energy patterns, not just chronological greed
- Multi-calendar support
- Re-sync/conflict resolution when the calendar changes after blocks are scheduled

## Notes

Cramless writes real events to your primary Google Calendar. Tokens are stored locally in `data/tokens.json` (gitignored) — never commit this file.
