# Vexa

Production React + TypeScript + Vite frontend for Vexa, wired to Supabase.

## Vercel
Set these Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use your Supabase project URL and browser-safe anon/publishable key. Never use a service-role key.

## Supabase Auth
Because Vexa uses username + password only through a synthetic internal email address, disable **Confirm email** for the Email provider.

## Build
`npm install`
`npm run build`

## Vexa V3 migration
Run `vexa-v3-migration.sql` after the existing Vexa SQL migrations. It adds reactions, blocks, mutes, server-side 10-minute message editing, and server-side 3-minute inactive chat expiration/vaporization.
