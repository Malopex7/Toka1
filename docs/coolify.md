# Coolify Deployment Guide — Toka Stack

This guide provides an end-to-end walkthrough for deploying the complete **Toka full-stack application** (Next.js 15 frontend, Express 5 backend with Socket.io WebSockets, and database/storage integration) using [Coolify](https://coolify.io/), the open-source, self-hosted PaaS platform.

---

## 1. Overview & Architecture

When deploying Toka to a VPS (e.g., Hetzner, DigitalOcean, AWS EC2, Linode, OVH) using Coolify, the architecture runs inside lightweight Docker containers orchestrated by Coolify and fronted by an automated **Traefik Reverse Proxy** with automatic Let's Encrypt SSL.

```
                  ┌─────────────────────────────────────────┐
                  │          Internet / Visitors            │
                  └──────────────────┬──────────────────────┘
                                     │ (HTTPS / WSS)
                                     ▼
                  ┌─────────────────────────────────────────┐
                  │       Coolify Traefik Proxy             │
                  │   (SSL Termination + WebSocket Routing) │
                  └──────────┬──────────────────┬───────────┘
                             │                  │
        https://app.domain   │                  │ https://api.domain (WSS)
                             ▼                  ▼
                 ┌──────────────────┐   ┌───────────────────┐
                 │  Toka Frontend   │   │   Toka Backend    │
                 │  (Next.js 15)    │   │ (Express 5 + WSS) │
                 │  Port: 3000      │   │ Port: 5000        │
                 └──────────────────┘   └─────────┬─────────┘
                                                  │
                        ┌─────────────────────────┼────────────────────────┐
                        ▼                         ▼                        ▼
                ┌───────────────┐         ┌───────────────┐        ┌───────────────┐
                │ MongoDB Atlas │         │ LiveKit Cloud │        │ Firebase /    │
                │ (or DB on VPS)│         │ (WebRTC SFU)  │        │ Supabase      │
                └───────────────┘         └───────────────┘        └───────────────┘
```

---

## 2. Prerequisites

1. **A Linux VPS** (Ubuntu 22.04 / 24.04 LTS recommended, minimum 2 CPU cores, 4GB RAM, 40GB SSD).
2. **Coolify installed on your VPS**:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. **Domain & DNS Records** pointing to your VPS Public IP:
   * `app.yourdomain.com` (or `@` root domain) ➔ `YOUR_VPS_IP` (Frontend)
   * `api.yourdomain.com` ➔ `YOUR_VPS_IP` (Backend API & Socket.io)
4. **GitHub Source Repository**: Coolify connected to GitHub via Coolify GitHub App or Personal Access Token with access to `Malopex7/Toka1`.

---

## 3. Recommended Deployment Option: Monorepo Multi-Application

Since Toka is structured as a monorepo (`/frontend` and `/backend`), deploying as **two linked applications from the same repository** in Coolify provides independent scaling, builds, logs, and zero-downtime rolling updates.

---

## 4. Backend Deployment (Express 5 + Socket.io)

### Step 1: Create Backend Application in Coolify
1. In your Coolify dashboard, navigate to **Projects** ➔ Select your Project & Environment (e.g., `Production`).
2. Click **+ New** ➔ **Application** ➔ **Public / Private GitHub Repository**.
3. Select your repository `Malopex7/Toka1` and branch `main`.
4. Configure the General Settings:
   * **Name**: `toka-backend`
   * **Build Pack**: `Nixpacks` (or `Dockerfile`)
   * **Base Directory**: `/backend`
   * **Port**: `5000`
   * **Domains**: `https://api.yourdomain.com` (replace with your backend domain)

### Step 2: Build & Start Commands (if using Nixpacks)
* **Install Command**: `npm install`
* **Build Command**: *(leave empty)*
* **Start Command**: `node src/index.js` (or `npm start`)

### Step 3: Backend Environment Variables
In Coolify, open the **Environment Variables** tab for `toka-backend` and add the following:

| Key | Description | Example / Note |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Internal HTTP/WebSocket port | `5000` |
| `MONGO_URI` | MongoDB Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/toka?retryWrites=true&w=majority` |
| `JWT_SECRET` | Secret for signing JWTs | *64+ character random string* |
| `FRONTEND_URL` | Production Frontend Origin | `https://app.yourdomain.com` |
| `PAYSTACK_SECRET_KEY` | Paystack Secret Key | `sk_live_...` (or `sk_test_...`) |
| `PAYSTACK_PUBLIC_KEY` | Paystack Public Key | `pk_live_...` (or `pk_test_...`) |
| `LIVEKIT_HOST` | LiveKit WebRTC SFU Server | `wss://toka-xxxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | LiveKit API Key | `API...` |
| `LIVEKIT_API_SECRET` | LiveKit Secret Key | `secret...` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | `toka-cd0bb` |
| `FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | `toka-cd0bb.firebasestorage.app` |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | `toka-cd0bb` |
| `SUPABASE_URL` | Supabase URL (if using Supabase) | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `sb_secret_...` |
| `GEMINI_API_KEY` | Google Gemini AI Key | `AIzaSy...` |

> [!TIP]
> **Password URL-Encoding**: If your MongoDB password contains special characters like `@`, `:`, `#`, or `/`, ensure they are URL-encoded (e.g. `@` becomes `%40`).

### Step 4: Configure WebSocket & Upload Size (Traefik Labels)
Socket.io and video file uploads require WebSocket proxying and an increased request body size limit.
In Coolify ➔ `toka-backend` ➔ **Advanced** ➔ **Custom Traefik Labels**, add:

```yaml
traefik.http.middlewares.backend-upload.buffering.maxRequestBodyBytes=104857600
traefik.http.routers.http-0-toka-backend.middlewares=backend-upload
```
*(This allows video/media uploads up to 100MB).*

### Step 5: Deploy Backend
Click **Deploy**. Once built, verify the health status by opening:
`https://api.yourdomain.com/` (should return JSON status `"Toka Backend API is running"`).

---

## 5. Frontend Deployment (Next.js 15)

### Step 1: Create Frontend Application in Coolify
1. In the same Coolify Project, click **+ New** ➔ **Application** ➔ **Public / Private GitHub Repository**.
2. Select `Malopex7/Toka1` and branch `main`.
3. Configure the General Settings:
   * **Name**: `toka-frontend`
   * **Build Pack**: `Nixpacks`
   * **Base Directory**: `/frontend`
   * **Port**: `3000`
   * **Domains**: `https://app.yourdomain.com` (or `https://yourdomain.com`)

### Step 2: Build & Start Commands
* **Install Command**: `npm install`
* **Build Command**: `npm run build`
* **Start Command**: `npm run start`

### Step 3: Frontend Environment Variables
> [!IMPORTANT]
> **Next.js Build-Time Variables (`NEXT_PUBLIC_*`)**: In Next.js, all environment variables starting with `NEXT_PUBLIC_` are baked into the client-side JavaScript bundles **at build time**. Make sure these variables are added in Coolify **before** triggering the initial build!

Add the following under **Environment Variables** in Coolify for `toka-frontend`:

| Key | Value / Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` *(Point to your Coolify Backend URL)* |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://toka-xxxx.livekit.cloud` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `toka-cd0bb.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `toka-cd0bb` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `toka-cd0bb.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `510564121374` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:510564121374:web:...` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-M8NXVED692` |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push VAPID Key from Firebase Console |

### Step 4: Deploy Frontend
Click **Deploy**. Coolify will execute the Next.js production build and start the SSR server on port 3000.

---

## 6. Alternative Option: Deploy via `docker-compose` Stack in Coolify

If you prefer deploying the entire stack from a single unified Docker Compose definition within Coolify:

1. In Coolify, click **+ New** ➔ **Service** / **Docker Compose**.
2. Paste the following configuration:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGO_URI=${MONGO_URI}
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=https://${FRONTEND_DOMAIN}
      - PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY}
      - LIVEKIT_HOST=${LIVEKIT_HOST}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${BACKEND_DOMAIN}`)"
      - "traefik.http.routers.backend.entrypoints=https"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5000"
      - "traefik.http.middlewares.backend-body.buffering.maxRequestBodyBytes=104857600"
      - "traefik.http.routers.backend.middlewares=backend-body"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=https://${BACKEND_DOMAIN}
        - NEXT_PUBLIC_SOCKET_URL=https://${BACKEND_DOMAIN}
        - NEXT_PUBLIC_LIVEKIT_URL=${LIVEKIT_HOST}
        - NEXT_PUBLIC_FIREBASE_API_KEY=${FIREBASE_API_KEY}
        - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN}
        - NEXT_PUBLIC_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      - backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${FRONTEND_DOMAIN}`)"
      - "traefik.http.routers.frontend.entrypoints=https"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
```

---

## 7. Post-Deployment Verification & Webhooks

### 1. Firebase Authorized Domains
1. Open [Firebase Console](https://console.firebase.google.com/) ➔ Project `toka-cd0bb` ➔ **Authentication** ➔ **Settings** ➔ **Authorized domains**.
2. Add your frontend domain: `app.yourdomain.com`.

### 2. Paystack Webhook Configuration
1. Open [Paystack Dashboard](https://dashboard.paystack.com/) ➔ **Settings** ➔ **API Keys & Webhooks**.
2. Set the **Webhook URL** to:
   ```
   https://api.yourdomain.com/api/transactions/webhook
   ```
3. Test a mock webhook to confirm deposits credit correctly to user wallets.

### 3. Verification Checklist
- [ ] Root Health Check: `curl https://api.yourdomain.com/` returns `200 OK` with JSON.
- [ ] WebSocket Connection: Open browser DevTools Network tab on `https://app.yourdomain.com` and ensure Socket.io connection establishes with status `101 Switching Protocols`.
- [ ] Authentication: Sign in with Google / Email and verify token exchange completes without CORS errors.
- [ ] Live Streaming: Test entering a LiveKit stream room to confirm WebRTC audio/video connections.

---

## 8. Troubleshooting & Common Issues

### Issue 1: `WebSocket connection to 'wss://api.domain.com/socket.io/...' failed`
* **Cause**: Traefik or Cloudflare (if orange-clouded) is buffering or dropping WebSocket upgrade headers.
* **Fix**: If using Cloudflare DNS, ensure **WebSockets** is toggled ON under Cloudflare Network settings, or temporarily set DNS record to *DNS Only (Grey Cloud)* while testing. Coolify Traefik natively proxies WebSockets without extra configuration.

### Issue 2: `413 Request Entity Too Large` on Video Uploads
* **Cause**: Traefik defaults to a smaller body buffer for requests.
* **Fix**: Ensure the Traefik label `maxRequestBodyBytes=104857600` is added to the backend in Coolify (as described in Section 4, Step 4).

### Issue 3: Next.js Frontend shows `API_URL is undefined` or connects to `localhost:5000`
* **Cause**: `NEXT_PUBLIC_API_URL` was not present at the time Next.js built the production bundle.
* **Fix**: In Coolify, double-check that `NEXT_PUBLIC_API_URL` is set under `toka-frontend` Environment Variables, then click **Redeploy** (Force rebuild with cache cleared).

---

*Maintained by: DevOps & Infrastructure (Sipho Khumalo) & Tech Lead (Lethiwe Shabalala)*
