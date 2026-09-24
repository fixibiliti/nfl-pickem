# NFL 5-Pick'em — Project Context

## Overview
A public NFL 5-Pick'em web application where users select 5 games each week against the spread/slate, lock in picks before kickoff, and track season-long rankings.

## Tech Stack & Architecture
- **Framework**: Next.js (App Router, React)
- **Database**: Upstash Redis (KV store)
- **Hosting**: Vercel
- **State Management**: React `useState`, `useEffect`
- **Data Sync**: Client fetches using `{ cache: 'no-store' }` against API routes.

## Core Data Endpoints
- `/api/slate`: Returns the weekly slate, user's current picks, and season standings.
- `/api/admin/users`: Commissioner view of all registered players and roles.
- `/api/picks`: Handles submitting and locking in player picks.

## Current State & Known Bugs to Resolve
1. **Leaderboard Inspection**: Clicking a player row sets `viewingUserId` and tab to `'slate'`, but `loadSlateAndScores` resets `viewingUserId` back to `user.id`. Needs clean separation.
2. **Submission Badges**: Leaderboard status badges show "Picking" for everyone because pick payloads are redacted before kickoff. Needs a dedicated server flag (e.g. `hasSubmitted`).

## Next Milestone: Option A (Terminal Scripts Sandbox)
- Build Node.js CLI scripts in `scripts/` to seed test users, simulate picks, and test time-based locking without waiting for live NFL kickoffs.
- Future expansion: College Football Pick'em app using this same architectural foundation.