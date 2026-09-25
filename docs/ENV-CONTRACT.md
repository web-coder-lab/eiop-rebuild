# Environment contract

Missing optional integrations must not crash the process. They must report `NOT_CONFIGURED`.

| Variable | Required to boot | Required for feature |
|---|---|---|
| PORT | no (3001) | listen |
| NODE_ENV | no | production headers |
| TRUST_PROXY | no | Render |
| CORS_ORIGIN | no (same-origin) | split frontend host |
| SESSION_SECRET | no | Part 4 sessions (`sessions: false` until set) |
| PRIVATE_API_* | no | feed, chat, media |
| FIREBASE_* | no | wallet ledger |
| PAYMENT_* | no | checkout |
| GOOGLE_* | no | Google login |
| MAX_STREAM_STORAGE_HOURS | no (6) | live retention job |

Never put PRIVATE_API_KEY, FIREBASE_PRIVATE_KEY, PAYMENT_* secrets, GOOGLE_CLIENT_SECRET, or SESSION_SECRET in `VITE_*` or Git.
