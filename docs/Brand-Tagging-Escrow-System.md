# Direct Brand Sponsorship Tagging & Escrow System User Guide

This guide describes how to use the **Brand Sponsorship Tagging and Escrow System** on Toka. The system features a double-sided verification workflow, private-to-public video uploads, pay-on-platform wallets, and a 7-day escrow protection period with dispute resolution.

---

## 👥 Roles & Workflows

### 1. Creators
Verified creators can request direct video sponsorship from verified brands.

*   **Step 1: Request Verification**
    *   Navigate to your profile or settings.
    *   Click **Request verification**. This flags your account for moderator safety audits (`verificationRequestStatus: 'pending'`).
*   **Step 2: Upload & Tag a Brand**
    *   Click the **Upload Video** button to open the upload modal.
    *   Toggle on **Request Brand Sponsorship** (visible only to verified creators).
    *   Search and select the target **Brand** from the dropdown menu of verified brand accounts.
    *   Enter your requested **Sponsorship Budget (ZAR)** and write a brief **Pitch/Terms message**.
    *   Click **Confirm & Upload Video**.
    *   *Note: Your video is automatically uploaded with `visibility: 'private'` and will not show on home feeds or profiles until sponsored.*
*   **Step 3: Track & Manage Requests**
    *   Open your **Sponsorships** page from the sidebar navigation.
    *   Under the **My Requests** tab, you can view the status of all sent pitches (`pending`, `approved`, `rejected`, `disputed`, `completed`).
    *   If a request is still `pending`, you can click **Withdraw** to cancel it.

---

### 2. Brands
Verified brands can discover verified creators and manage incoming sponsorship requests.

*   **Step 1: Request Verification**
    *   Submit a verification request through your profile page to become a verified brand.
*   **Step 2: Review Requests & Approve**
    *   Go to the **Sponsorships** dashboard from the sidebar navigation.
    *   In the **Pending Requests** tab, view incoming creator pitches.
    *   Click **Review Video** to watch the private video upload in a secure popup overlay.
    *   Check your wallet balance. If you have enough funds, click **Approve & Pay**.
        *   *Result: The sponsorship fee is debited from your wallet balance and held in platform escrow. The video's visibility is updated to `public` (making it visible on main feeds).*
    *   If you don't wish to sponsor the video, click **Reject** (video remains private).
*   **Step 3: Escrow Disputes**
    *   Approved sponsorships enter a **7-day protection period** before funds are released to the creator.
    *   Under the **Sponsorship History** tab, you can view active escrows and a countdown timer.
    *   If there is a breach of contract or violation, click **Dispute Payout** to lock the escrow funds and flag a moderator for manual audit.

---

### 3. Moderators
Moderators oversee the safety verification process and resolve financial disputes.

*   **Step 1: Process User Verifications**
    *   Navigate to the **Moderator Panel** from the sidebar.
    *   Open the **Verification Requests** tab.
    *   Review pending creators and brands and click **Approve Verify** or **Decline**.
*   **Step 2: Resolve Escrow Disputes**
    *   Open the **Sponsorship Disputes** tab in the Moderator Panel.
    *   View disputed items, watch the associated video, and read terms.
    *   Choose one of two resolutions:
        *   **Release Payout:** Releases funds to the creator's wallet (minus a 10% platform fee).
        *   **Refund Brand:** Returns the full ZAR sponsorship amount back to the brand's wallet (setting video visibility back to `private`).

---

## 💰 Escrow & Platform Revenue Details

1.  **Fund Lock:** Upon brand approval, the sponsorship fee is immediately debited from the brand's wallet and held in a `held` escrow status.
2.  **Auto-Release Period:** The funds remain held for exactly **7 days**.
3.  **Cron Release Trigger:** After 7 days, the platform cron job (`POST /api/sponsorships/process-escrows`) processes due escrows:
    *   **90%** of the budget is paid directly into the **Creator's wallet**.
    *   **10%** is collected as **Platform commission revenue**.
    *   Sponsorship status changes to `completed` and escrow status becomes `released`.

---

## 🛠️ API Developer Cheat Sheet

For backend integrations, use the following endpoints:

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/users/request-verification` | Authenticated | Requests verification |
| `GET` | `/api/users/verification-requests` | Moderator | Lists pending user verifications |
| `PATCH` | `/api/users/:id/verify-status` | Moderator | Approves or rejects user verifications |
| `GET` | `/api/users/verified-brands` | Creator | Autocompletes verified brands |
| `GET` | `/api/users/directory` | Verified | Contextual listing of verified profiles |
| `POST` | `/api/sponsorships/create` | Verified Creator | Submits a new request |
| `GET` | `/api/sponsorships/brand/pending` | Brand | Returns inbox/all requests |
| `POST` | `/api/sponsorships/:id/approve` | Brand | Pays and moves funds to escrow |
| `POST` | `/api/sponsorships/:id/dispute` | Brand | Locks escrow payout |
| `POST` | `/api/sponsorships/:id/resolve` | Moderator | Resolves disputed payouts |
