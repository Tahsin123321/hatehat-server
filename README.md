# HateHat API

Express + MongoDB server for the HateHat events platform.

**Live API:** https://YOUR-SERVER-URL.vercel.app
**Client repo:** https://github.com/YOUR-USERNAME/hatehat-client

## Run locally

```bash
npm install
cp .env.example .env     # set MONGODB_URI and AUTH_URL
npm run seed             # optional: inserts 8 sample upcoming events
npm run dev              # http://localhost:5000
```

## Auth

Protected routes expect `Authorization: Bearer <jwt>`. Tokens are issued by Better Auth in the client app and verified here with `jose` against `AUTH_URL/api/auth/jwks` (issuer and audience must equal `AUTH_URL`).

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/events` | public | Upcoming only. `?limit=&q=&type=&sort=soonest\|latest` |
| GET | `/events/:id` | public | Includes participant count |
| POST | `/events` | JWT | Validates fields, future date only; stores creator email |
| GET | `/my-events` | JWT | Events created by the caller |
| PUT | `/events/:id` | JWT | Creator only (403 otherwise) |
| DELETE | `/events/:id` | JWT | Creator only; also removes its joins |
| GET | `/events/:id/joined` | JWT | Has the caller joined? |
| POST | `/events/:id/join` | JWT | Unique per user and event (409 on repeat) |
| GET | `/joined-events` | JWT | Caller's joined events sorted by date |

## Deploy

Vercel: import the repo, add the env vars, deploy (`vercel.json` included). Render: `npm start`.
