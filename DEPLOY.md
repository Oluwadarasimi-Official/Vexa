# Vexa Production Deployment

## 1. Supabase migration
Run `profile-migration.sql` once in Supabase SQL Editor. It adds profile name, bio, avatar URL, privacy/preferences, and creates the public `avatars` storage bucket with secure per-user upload/update/delete policies.

## 2. Vercel environment variables
Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the URL and browser-safe publishable/anon key from your Supabase project. Never use a service-role key in Vercel client environment variables.

## 3. Auth
Keep Supabase Email provider enabled because Vexa uses an internal synthetic email behind the username-only UI. Turn **Confirm email** off so Vexa does not ask users to verify an email address.

## 4. Deploy
Import this project into Vercel and deploy with the standard Vite build command:
`npm run build`

Output directory:
`dist`

The project already includes the Vercel SPA rewrite configuration.
