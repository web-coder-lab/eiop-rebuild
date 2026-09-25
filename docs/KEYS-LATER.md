# Keys you will add later (do not paste in chat)

Put these only in server `.env` or Render env. Never `VITE_*`. Never Git.

## When you are ready

1. **Gmail SMTP** — OTP mail  
   `SMTP_USER` `SMTP_APP_PASSWORD` `SMTP_FROM`

2. **Content / media database API** (reels, photos, videos)  
   `PRIVATE_API_BASE_URL` `PRIVATE_API_KEY`

3. **Firebase project** (payments + json/txt + later APK)  
   `FIREBASE_PROJECT_ID`  
   `FIREBASE_CLIENT_EMAIL`  
   `FIREBASE_PRIVATE_KEY`  
   `FIREBASE_STORAGE_BUCKET`

   Planned Storage paths:
   - `payments/` wallet ledger
   - `artifacts/json/`
   - `artifacts/txt/`
   - `artifacts/apk/`  (`app.apk` / package file)

4. **Payment gateway**  
   `PAYMENT_GATEWAY_BASE_URL`  
   `PAYMENT_GATEWAY_SECRET`  
   `PAYMENT_WEBHOOK_SECRET`  
   Webhook URL: `https://<host>/api/v1/payments/webhook`

5. **Android file**  
   Either upload to Firebase `artifacts/apk/` later, or set `APK_PATH` to the server file.

6. **Google login**  
   `GOOGLE_CLIENT_ID` (and secret only if you use code exchange)

7. **Sessions**  
   `SESSION_SECRET` (32+ random characters)

Until a key exists, that feature returns `NOT_CONFIGURED` / 503. The UI does not fake success.
