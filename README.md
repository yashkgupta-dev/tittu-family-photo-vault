# TITTU — Personal Family Photo Vault

TITTU is a mobile-first web app for organizing family photos and videos. It supports Google sign-in, albums, favorites, a trash view, upload progress, and file-integrity checks before a user relies on a cloud copy.

> This is a student project and should be treated as a work in progress. Review the security rules and cloud configuration for your own Firebase and Supabase projects before storing personal media.

## Features

- Google sign-in with Firebase Authentication
- Photo and video metadata, albums, favorites, and trash in Cloud Firestore
- Supabase Storage integration for media files, with owner-scoped paths and server routes for authenticated storage operations
- SHA-256 integrity checks and upload status
- Responsive interface and installable PWA assets
- Firestore and Firebase Storage rules included in the repository

## Architecture

- **Frontend:** React, TypeScript, Vite
- **Authentication and metadata:** Firebase Authentication and Cloud Firestore
- **Media files:** Supabase Storage
- **Server:** Express routes in `server.ts`; validates Firebase ID tokens before protected storage operations

The repository contains application code and configuration examples. It should not contain family photos, private keys, Supabase secret keys, service-account JSON files, or signed media URLs.

## Run locally

### Requirements

- Node.js compatible with the versions in `package.json`
- A Firebase project with Google sign-in enabled, Firestore, and Firebase Storage configured
- A Supabase project with a **private** Storage bucket

### Setup

1. Clone this repository and install dependencies:

   ```bash
   npm install
   ```

   The project also includes `bun.lock` for Bun users.

2. Copy `.env.example` to `.env.local` and add your own Supabase project URL and public publishable/anon key. Keep server-only secrets out of variables prefixed with `VITE_`.

3. Configure `firebase-applet-config.json` with the Firebase **web app** configuration for your own project. This web configuration is used by the browser; it is not a Firebase Admin service-account credential. Restrict the Firebase API key to the APIs and websites that your app needs.

4. Add the server-only `SUPABASE_SECRET_KEY` to your local environment if you are using the privileged server-side storage routes. Never put it in `VITE_SUPABASE_*`, browser code, screenshots, or Git. Do not use a service-role/secret key as the public anon key.

5. Configure the private Supabase bucket and its access policies for the `users/<userId>/media/...` path layout. Review `supabase_storage_rls.sql` before applying it to any existing project; it changes Storage policies. Do not make a family-media bucket public.

6. Deploy the rules in `firestore.rules` and `storage.rules` to your own Firebase project, then set authorized domains for Google sign-in.

7. Start the development server:

   ```bash
   npm run dev
   ```

   Open the local URL printed by the server.

## Environment variables

See `.env.example` for client-side placeholders. Add real values only to an ignored local environment file or your hosting provider's secret manager. The server reads `SUPABASE_SECRET_KEY` (or the legacy server-side alternatives in `server.ts`); that key must remain server-only.

## Security notes

- Keep `.env*` files, private keys, Firebase service-account files, family media, and signed URLs out of Git.
- Firebase browser API keys and Supabase publishable/anon keys are public client configuration, not substitutes for security rules. Restrict the Firebase key and enforce access with Firebase/Supabase rules.
- Use a private Supabase bucket and short-lived signed URLs for private media.
- Review the rules and SQL for your own project before deploying. A public repository does not make the app's cloud data private by itself.
- Do not rely on this project as the only backup for irreplaceable photos.

## Repository map

- `src/` — application UI and storage/authentication clients
- `server.ts` — Express server and protected storage routes
- `firestore.rules`, `storage.rules` — Firebase access rules
- `supabase_storage_rls.sql` — example Supabase Storage policy setup; review before use
- `security_spec.md`, `test_security_validation.ts` — security notes and validation code

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.



