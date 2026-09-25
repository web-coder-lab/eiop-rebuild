# Everything IOP rebuild

New implementation. Old everything-iop.onrender.com is the reference product, not this codebase.

## Local

cp .env.example .env
# set SESSION_SECRET (32+ chars). Add SMTP_* when you want real email.
npm install
npm run dev

Open http://localhost:3001

## Render

Create a new web service from this folder. Do not overwrite the old service until you choose cutover.

- Build: npm install && npm run build
- Start: npm start
- Health: /api/v1/health/live
- Set SESSION_SECRET before production login
- Keys: docs/KEYS-LATER.md

Render disk is ephemeral unless you attach a disk to DATA_DIR.
