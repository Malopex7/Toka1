# How to Run Toka Platform & Live Streaming Locally

This guide walks you through setting up and running the entire full-stack Toka application locally, including the LiveKit SFU Media Server, Node.js & Express backend, and Next.js frontend.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.17+ or v20+
- **npm**: v9+
- **Docker Desktop** *(Recommended for LiveKit SFU)* or the standalone Windows LiveKit binary
- **Git**

---

## 🏗️ Architecture & Required Services

To run the full Toka experience, three services work together:

| Service | Port | Description |
| :--- | :--- | :--- |
| **LiveKit SFU Server** | `7880` (HTTP/WS), `7881` (TCP), `7882` (UDP) | Real-time WebRTC media relay server |
| **Backend API Server** | `5000` | Express 5, MongoDB, Socket.io, LiveKit Admin SDK |
| **Frontend Web App** | `3000` | Next.js 16 App Router, React 19, Tailwind CSS v4 |

---

## 🚀 Step 1: Start LiveKit SFU Server

### Option A: Via Docker (Recommended)

Ensure Docker Desktop is open and running, then execute:

```bash
docker run --rm -d --name toka-livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev --bind 0.0.0.0
```

> **Note**: `--bind 0.0.0.0` ensures the container accepts connections forwarded from your host machine (`localhost`).

**Verify LiveKit Docker Status:**
```bash
docker ps
curl http://localhost:7880
# Output should return: OK
```

### Option B: Via Native Standalone Binary (Windows)

If you prefer running LiveKit directly without Docker:

```powershell
& "$env:USERPROFILE\.livekit\bin\livekit-server.exe" --dev
```

---

## ⚙️ Step 2: Start the Backend Server

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure your `.env` file is present in `backend/` with the following variables:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/toka-db
   JWT_SECRET=your_jwt_secret

   # LiveKit Local Config (Defaults match --dev mode)
   LIVEKIT_HOST=ws://localhost:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret

   # Paystack & Other Integrations
   PAYSTACK_PUBLIC_KEY=pk_test_...
   PAYSTACK_SECRET_KEY=sk_test_...
   ```

4. Start the backend in development mode:
   ```bash
   npm run dev
   ```

The backend starts with **Socket.io enabled** on `http://localhost:5000`.

---

## 💻 Step 3: Start the Frontend Web App

1. Open a second terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure `.env.local` is present in `frontend/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=toka-cd0bb.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=toka-cd0bb
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🎥 Testing the Live Streaming Feature

### 1. Go Live (Creator)
- Sign in to your account.
- Click the **Go Live** button in the left desktop sidebar.
- Enter a title (e.g. *"Evening Tech Talk"*).
- Select access level:
  - **Public**: Open to all viewers.
  - **Private**: Choose Entry Fee (ZAR), Monthly Subscription, or Tip to Join threshold.
- Click **Start Live Stream** — your browser will request camera/microphone permissions and open the stream room.

### 2. Join Stream (Viewer)
- Open a second browser window (or incognito tab) and navigate to `http://localhost:3000`.
- Click on the **Live** tab in the top navigation bar or sidebar.
- Select the active stream card.
- If public, you join immediately. If private, the paywall modal will prompt you to unlock access using your wallet balance.

### 3. In-Stream Interactions
- **Live Chat**: Type in the chat panel to broadcast messages via Socket.io.
- **Tip ZAR**: Click the **Tip ZAR** button to send instant micro-tips (R5, R10, R25, custom amount). Tips render as animated golden banners in the chat and adjust creator/viewer wallets.
- **Invite Co-Host**: Creator can invite other users by username to broadcast collaboratively.
- **Auto Replay Download**: When the creator clicks **End Stream**, the recorded MP4/WebM stream file automatically downloads in their browser.

---

## 🛠️ Troubleshooting & Commands

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| `failed to connect to docker API` | Docker Desktop is closed or WSL kernel needs updating | Run `wsl --update` in PowerShell, then launch Docker Desktop. |
| `curl: (52) Empty reply from server` | LiveKit container not bound to 0.0.0.0 | Restart container with `--bind 0.0.0.0` flag. |
| `Stream unavailable` | LiveKit server is not running on port 7880 | Verify LiveKit container is running with `docker ps` or restart with Step 1. |
| `Insufficient wallet balance` | User wallet has less ZAR than tip/fee | Visit `http://localhost:3000/deposit` to deposit test funds into your wallet. |

---

## 🛑 Stopping Services

- **Stop LiveKit Docker**: `docker stop toka-livekit`
- **Stop Backend**: Press `Ctrl + C` in the backend terminal.
- **Stop Frontend**: Press `Ctrl + C` in the frontend terminal.
