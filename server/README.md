# PestFlow Quiz Backend

Tiny Node/Express service that:

1. Receives quiz submissions from the wireframe via `POST /api/quiz-submissions`.
2. Stores them as newline-delimited JSON at `data/submissions.ndjson`.
3. Serves a styled admin dashboard at `GET /admin` (token-gated).

This is intentionally lightweight so it can be deployed to Railway / Render / Fly.io / a small VPS in a few minutes, or copied into the actual `app.pestflow.org` repo once the quiz is ready to go live.

## Run locally

```bash
cd server
npm install
ADMIN_TOKEN=letmein npm start
# → :8787
# admin → http://localhost:8787/admin   (paste "letmein" when prompted)
```

## Wire the wireframe to it

Open `paywall-quiz.html` and set:

```js
window.PESTFLOW_QUIZ_API = 'http://localhost:8787/api/quiz-submissions';
```

(or update the constant `API_URL` at the top of the script block).

For production: point it at wherever this server is deployed, e.g.
`https://app.pestflow.org/api/quiz-submissions` — and set `CORS_ORIGINS`
on the server to the wireframe's origin.

## Environment variables

| Var            | Default                        | Notes                                                  |
|----------------|--------------------------------|--------------------------------------------------------|
| `PORT`         | `8787`                         |                                                        |
| `ADMIN_TOKEN`  | `dev-admin-token-change-me`    | **Set this in production.** Required for `/admin`.     |
| `DATA_DIR`     | `./data`                       | Where `submissions.ndjson` lives.                      |
| `CORS_ORIGINS` | `*`                            | Comma-separated allowlist, e.g. `https://app.pestflow.org,https://gicheru214.github.io` |

## Endpoints

- `GET  /health` — `{ ok: true }`
- `POST /api/quiz-submissions` — public; body shape:
  ```json
  {
    "answers":   { "0": { "val": 2, "revealed": true }, ... },
    "revenue":   142000,
    "score":     73,
    "breakdown": { "retention": 64, "efficiency": 71, "leads": 82 },
    "contact":   { "name": "...", "email": "...", "phone": "...", "business": "..." },
    "durationMs": 184000,
    "pausedSteps": [3, 7]
  }
  ```
- `GET  /api/quiz-submissions` — requires header `X-Admin-Token: ...`
- `GET  /admin` — admin dashboard (HTML)
