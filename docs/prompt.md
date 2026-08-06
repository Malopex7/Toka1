# System Context & Project Objective
You are an expert full-stack engineer tasked with building "Toka," a short-form video platform designed for the African creator economy. Unlike TikTok, Toka's business model relies on two distinct pillars:
1. Direct-to-creator micro-transactions (mobile money tipping).
2. A strict AI-driven Brand Safety vetting pipeline to secure premium advertiser sponsorships.

# Tech Stack Strict Requirements
You must strictly adhere to the following stack:
*   **Frontend:** Next.js (App Router), styled with Tailwind CSS v4 and shadcn/ui components.
*   **Frontend State Management:** Zustand (specifically for managing the high-frequency state of the scrolling video feed and active user session).
*   **Backend:** Node.js with Express.js.
*   **Database & ORM:** MongoDB using Mongoose for strict schema enforcement.
*   **Form Handling/Validation:** React Hook Form + Zod.

---

# Phase 1: Database Architecture (Mongoose)
Implement the following Mongoose schemas in the Express backend to support the core logic. 

1. **User Schema (`User`)**
   - Fields: `username`, `walletBalance` (Number), `role` (enum: ['creator', 'brand', 'moderator', 'fan']), `isBrandSafeVerified` (Boolean), `strikeCount` (Number).
2. **Video Schema (`Video`)**
   - Fields: `creatorId` (Ref: User), `videoUrl`, `title`, `tier` (enum: ['fan_funded', 'brand_safe']).
   - **Crucial - Vetting State Machine:** Include `vettingStatus` (enum: ['processing', 'ai_review', 'human_review', 'approved', 'rejected']), `aiConfidenceScore` (Number 0-100), `riskFlags` (Array of Strings).
3. **Transaction Schema (`Transaction`)**
   - Fields: `senderId` (Ref: User), `receiverId` (Ref: User), `videoId` (Ref: Video), `amount` (Number), `currency` (String, default: 'ZAR'), `status` (enum: ['pending', 'success', 'failed']), `type` (enum: ['tip', 'brand_sponsorship']).

---

# Phase 2: Backend API (Express.js)
Build RESTful endpoints to handle the frontend requests:
1. **Feed Service:** `GET /api/feed` - Return videos paginated. Must filter by `vettingStatus === 'approved'` if requested by a brand account.
2. **Monetization Service:** `POST /api/transactions/tip` - Mock a mobile money transaction (e.g., Paystack/M-Pesa) updating the sender and receiver wallet balances atomically.
3. **Vetting Webhook Endpoint:** `POST /api/webhooks/ai-vetting` - Receives payload from the AI transcription/NLP service, updates the Video's `aiConfidenceScore`. If score < 70, set to 'rejected'. If 70-94, set to 'human_review'. If 95+, set to 'approved'.

---

# Phase 3: Frontend State Management (Zustand)
Create a centralized Zustand store (`useFeedStore`) to handle the video feed without causing unnecessary re-renders.
*   **State Variables:** `videos` (Array), `currentIndex` (Number), `isLoading` (Boolean), `activeVideoId` (String).
*   **Actions:** `fetchNextPage()`, `setCurrentIndex(index)`, `optimisticTip(videoId, amount)`.
*   **Constraint:** The feed must pre-fetch the next 3 videos in the background to ensure seamless scrolling on mobile networks.

---

# Phase 4: UI/UX Guidelines (Tailwind 4 + shadcn/ui)
*   **Mobile-First:** Toka is primarily used on mobile phones. Design the feed as a full-screen vertical swipe interface (100dvh). 
*   **The Feed Overlay:** Use absolute positioning to layer the Creator Info, "Tip" button (using a shadcn `<Button>` with a coin icon), and Like button over the video player.
*   **Brand Safety Dashboard (Admin/Moderator):** Create a separate route (`/moderation`) using shadcn `<DataTable>` to list videos with `vettingStatus === 'human_review'`. Include quick-action buttons to "Approve" or "Reject", displaying the specific `riskFlags` returned by the AI.
*   **Theme:** Implement a sleek Dark Mode default.

---

# Execution Steps
Please execute this build step-by-step, pausing for my review after each phase:
1. Initialize the backend Node/Express project and write the complete Mongoose schemas.
2. Build the core Express endpoints for the Feed and Tipping engine.
3. Initialize the Next.js frontend, install Tailwind 4 + shadcn/ui, and set up the Zustand feed store.
4. Build the UI for the Mobile Video Feed and the Moderator Dashboard.

Begin with Step 1: Initialize the backend and output the Mongoose models.