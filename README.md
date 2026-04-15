# Subscription Hub

Subscription Hub is a full-stack mobile-first app to manage recurring subscriptions
with dark modern UI, anonymous onboarding, and optional account authentication.

## Stack

- Mobile: Expo Router + React Native (TypeScript)
- Backend: FastAPI + MongoDB
- Auth: Anonymous by device ID (up to 10 subscriptions) + account login/register
- Notifications: Expo notifications permission flow
- Analytics: Monthly/yearly totals, category breakdown, upcoming renewals

## Project structure

```txt
backend/
  server.py
  requirements.txt
  .env.example

frontend/
  app/
    _layout.tsx
    auth.tsx
    (tabs)/
      _layout.tsx
      index.tsx
      add.tsx
      analytics.tsx
      settings.tsx
  src/
    context/AppContext.tsx
    constants/theme.ts
  package.json
  app.json
  tsconfig.json
  babel.config.js
  .env.example
```

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run start
```

## Notes

- Anonymous mode works without login for the first 10 subscriptions per device.
- The 11th subscription requires account creation/login.
- Existing anonymous subscriptions are migrated to the account after auth.