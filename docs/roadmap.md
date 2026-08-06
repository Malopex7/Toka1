# Toka Development Roadmap
**Project:** Toka (African Creator Economy Short-Video Platform)
**Stack:** Next.js 16, Tailwind 4, shadcn/ui, Zustand 5, Firebase Client SDK (Frontend) | Node.js, Express.js 5, MongoDB, Mongoose 8, Firebase Admin SDK (Backend)
**Environment:** Cursor IDE

---

## Phase 1: Project Initialization & Environment Setup
**Goal:** Scaffold the monorepo architecture and configure the development environment.

- [x] **1.1 Workspace Setup**
  - [x] Initialize Git repository.
  - [x] Set up monorepo structure with `/backend` and `/frontend` directories (instead of `/toka-server` and `/toka-client`).
- [x] **1.2 Backend Initialization**
  - [x] Initialize Node.js project in `/backend`.
  - [x] Install dependencies: `express`, `mongoose`, `dotenv`, `bcryptjs`, `jsonwebtoken` (Note: `cors`, `helmet`, and `firebase-admin` still need to be configured).
  - [x] Set up Express server boilerplate and basic error handling.
- [x] **1.3 Frontend Initialization**
  - [x] Initialize Next.js app in `/frontend` (App Router enabled).
  - [x] Install and configure Tailwind CSS v4.
  - [x] Initialize `shadcn/ui` (alert-dialog, button installed) and configure the default theme (dark mode preferred).
  - [x] Install `zustand` for state management.
  - [x] **[NEW - Firebase Integration]** Install `firebase` client SDK and initialize the Firebase app configuration.

---

## Phase 2: Database Architecture & Data Modeling
**Goal:** Establish the strict Mongoose schemas required for the financial ledgers and AI vetting pipeline.

- [x] **2.1 Database Connection**
  - [x] Connect Express to MongoDB (using Atlas database connection string via `.env`).
- [x] **2.2 Mongoose Schemas**
  - [x] Create `User` schema (`username`, `walletBalance`, `role` [creator, brand, moderator, fan], `isBrandSafeVerified`, `strikeCount`).
    - *Note:* Password hashing is offloaded to **Firebase Authentication**, but we've added a link field: `firebaseUid` (String, unique).
  - [x] Create `Video` schema (`creatorId`, `videoUrl` [Firebase Storage CDN URL], `title`, `tier` [fan_funded, brand_safe], `vettingStatus` [processing, ai_review, human_review, approved, rejected], `aiConfidenceScore`, `riskFlags`).
  - [x] Create `Transaction` schema (`senderId`, `receiverId`, `videoId`, `amount`, `currency` [default: ZAR], `status` [pending, success, failed], `type` [tip, brand_sponsorship]).
- [ ] **2.3 Seed Data**
  - [ ] Write a seed script to generate dummy users (with fake Firebase UIDs), vetted videos, and pending videos to test the UI later.

---

## Phase 3: Core Backend API Development & Authentication
**Goal:** Build the essential RESTful endpoints to serve the frontend and handle logic.

- [x] **3.1 Authentication & Authorization (Firebase offloaded)**
  - [x] Set up Firebase Admin SDK in the `/backend`.
  - [x] Implement Express middleware to verify incoming Firebase ID Tokens (`jwt`) via `firebase-admin`.
  - [x] Create role-based authorization middleware using the Mongoose user profile (`isBrand`, `isModerator`, etc.).
- [x] **3.2 The Video Feed API**
  - [x] `GET /api/feed` - Return paginated videos.
  - [x] Implement query logic: return ONLY `vettingStatus: 'approved'` if the requester is a brand.
- [x] **3.3 The Wallet & Tipping API**
  - [x] `POST /api/transactions/tip` - Mobile money transaction Paystack updating the sender and receiver wallet balances atomically.
  - [x] Wrap the transaction logic in a Mongoose session/transaction to ensure atomic wallet balance updates.
- [x] **3.4 Vetting Webhook API**
  - [x] `POST /api/webhooks/ai-vetting` - Endpoint to receive updates from the AI transcription/NLP service.
  - [x] Implement automatic vetting status transition based on `aiConfidenceScore` thresholds:
    - Score < 70: Set status to `'rejected'`.
    - Score 70 - 94: Set status to `'human_review'`.
    - Score >= 95: Set status to `'approved'`.

---

## Phase 4: Frontend State, Auth & Feed Architecture
**Goal:** Set up the secure authentication flow and high-performance scrolling feed using Next.js, Zustand, and Firebase.

- [ ] **4.1 Firebase Authentication Integration (Frontend)**
  - [ ] Build login/signup forms in Next.js using `shadcn/ui`.
  - [ ] Connect forms to Firebase Auth Client SDK (Email/Password, Google Sign-in).
  - [ ] Sync authenticated Firebase users with the Mongoose User profiles in the database.
- [ ] **4.2 Zustand Store Setup**
  - [ ] Create `useFeedStore.ts` to manage the active video feed and user session.
  - [ ] State variables: `videos` (Array), `currentIndex` (Number), `isLoading` (Boolean), `activeVideoId` (String).
  - [ ] Actions: `fetchNextPage()`, `setCurrentIndex(index)`, `optimisticTip(videoId, amount)`.
  - [ ] Implement background pre-fetching logic (fetch next 3 videos to ensure seamless scrolling).
- [ ] **4.3 The Video Player & Firebase Storage**
  - [ ] Build a performant HTML5 video player component that auto-plays/pauses based on viewport intersection.
  - [ ] Configure the player to stream directly using CDN-cached media URLs hosted on **Cloud Storage for Firebase**.
- [ ] **4.4 The Mobile Feed Layout**
  - [ ] Build the 100dvh full-screen vertical swipe interface.
  - [ ] The Feed Overlay: Use absolute positioning to layer Creator Info, "Tip" button (shadcn `<Button>` with a coin icon), and Like button over the video player.

---

## Phase 5: Brand Safety & Moderation Dashboards
**Goal:** Build the administrative interfaces for the Human-in-the-Loop (HITL) review process.

- [ ] **5.1 Moderator Dashboard (Frontend)**
  - [ ] Create the `/moderation` route (protected using custom Firebase Admin auth checks).
  - [ ] Implement a `shadcn/ui` `<DataTable>` to list videos with `vettingStatus === 'human_review'`.
- [ ] **5.2 Review Interface**
  - [ ] Build a split-screen view: Video player on the left, AI Risk Flags and transcribed text on the right.
  - [ ] Add quick-action buttons to "Approve" and "Reject" displaying specific `riskFlags` returned by the AI.
- [ ] **5.3 Moderation API Links**
  - [ ] Connect the dashboard buttons to `PATCH /api/videos/:id/vetting-status`.

---

## Phase 6: Ecosystem Integrations (AI, Fintech & Notifications)
**Goal:** Connect Toka to the external services that power its unique value proposition.

- [ ] **6.1 AI Pipeline Integration**
  - [ ] Connect the backend video upload process to the transcription service (e.g., Meta MMS or Whisper API).
  - [ ] Send transcripts to the NLP classifier (e.g., InkubaLM or AfriBERTa API) for the confidence score.
  - [ ] Update the Mongoose Video document with the results.
- [ ] **6.2 Mobile Money Integration**
  - [ ] Integrate a local payment gateway (Paystack, Flutterwave, or Chipper Cash API) for depositing funds into the Toka wallet.
  - [ ] Implement the webhook listener to verify successful deposits before updating the Mongoose `User.walletBalance`.
- [ ] **6.3 Firebase Cloud Messaging (FCM)**
  - [ ] **[NEW - Push Notifications]** Set up FCM service worker in Next.js to request permissions and receive messages.
  - [ ] Implement backend triggers in the API routes (or database middleware) to send real-time notification payloads via FCM (e.g. "Received a 10 ZAR tip!" or "Your video is approved!").

---

## Phase 7: Polish & Optimization
**Goal:** Prepare the app for a smooth user experience on mobile networks.

- [ ] **7.1 Video Optimization & Direct Uploads**
  - [ ] Configure client-side compression before uploading videos directly to **Cloud Storage for Firebase** to minimize server load.
  - [ ] Alternatively, set up server-side HLS video transcoding pipeline if required.
- [ ] **7.2 UI/UX Refinements**
  - [ ] Add micro-interactions (e.g., coin animation on tip, heart burst on like).
  - [ ] Ensure strict responsive design for various mobile screen sizes.
  - [ ] Implement loading skeletons for the feed and dashboards.
- [ ] **7.3 Firebase Performance Monitoring & Crashlytics**
  - [ ] **[NEW - Monitoring]** Initialize Firebase Performance Monitoring client-side to track vertical feed rendering latency, media stream start latency, and API network response speeds.
  - [ ] Configure Firebase error reporting / Crashlytics web SDK to track unexpected client-side execution crashes.

---

## Phase 8: Deployment 
**Goal:** Launch the application to live servers.

- [ ] **8.1 Backend Deployment**
  - [ ] Deploy the Node/Express backend (e.g., to Render).
  - [ ] Set up Firebase Admin credentials and MongoDB Atlas connection string in the production environment variables.
- [ ] **8.2 Frontend Deployment**
  - [ ] Deploy the Next.js frontend (e.g., to Vercel).
  - [ ] Configure custom domain, SSL, and Firebase environment configuration variables.
  - [ ] Set `NEXT_PUBLIC_API_URL` to point to the production backend.
- [ ] **8.3 End-to-End Testing**
  - [ ] Run complete flow tests: Firebase Sign-in -> Video Upload to Storage -> AI Vetting -> Human Review -> Tip via Mobile Money -> FCM Push Notification.