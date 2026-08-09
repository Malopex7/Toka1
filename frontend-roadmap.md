# Toka Frontend Operational Roadmap

This document identifies all non-functional/static UI buttons, navigation links, and popups in the Toka frontend and details the precise implementation steps required to make them fully operational.

---

## 1. Audit of Non-Functional UI Elements

### 1.1 Wallet & Top-Up Access (High Priority)
* **Elements**: 
  * Desktop sidebar: `ZAR {mongooseUser?.walletBalance}` text block.
  * Mobile header: `Z` / `ZAR` balance label.
* **Current Behavior**: Static, unclickable labels. Users cannot navigate to the Top-Up workspace.
* **Required Operation**: Convert these labels into interactive links/buttons that redirect authenticated users to the `/deposit` page.

### 1.2 Feed Interaction Sidebar (Medium Priority)
* **Follow Button (`+` icon on creator avatar)**:
  * **Current Behavior**: Static button with no event handler.
  * **Required Operation**: Implement an optimistic toggle. On click, call `POST /api/users/follow/:creatorId`, update UI follower counts, and transition the `+` icon into a checkmark or slide it out.
* **Share Button**:
  * **Current Behavior**: Static button.
  * **Required Operation**: Integrate the standard Web Share API (`navigator.share()`) with fallback to copying the video stream URL directly to the clipboard (with a "Link copied to clipboard!" toast notification).
* **More Button (`...` options)**:
  * **Current Behavior**: Static button.
  * **Required Operation**: Open a popover menu featuring "Report Video", "Block Creator", and "Copy Raw Video URL".

### 1.3 Navigation Tabs & Pages (Medium Priority)
* **Discover Tab (Desktop Sidebar & Mobile Bottom Nav)**:
  * **Current Behavior**: Static button.
  * **Required Operation**: Create a `/discover` page featuring search queries, categories (Afrobeats, Dance, Cooking, Tech), and trending hashtags.
* **Following vs. For You Tabs**:
  * **Current Behavior**: Static labels.
  * **Required Operation**: Bind to feed query requests. "Following" should request `GET /api/feed?following=true` (filtering to followed creators), whereas "For You" pulls the default vetted feed.
* **Inbox Tab (Desktop Sidebar & Mobile Bottom Nav)**:
  * **Current Behavior**: Alerts a temporary mock notification.
  * **Required Operation**: Create a slide-out drawer or page showing tipping activity ("@user tipped you R20!"), brand vetting updates, and followers lists.
* **Profile / Me Tab (Mobile Bottom Nav)**:
  * **Current Behavior**: Alerts user credentials.
  * **Required Operation**: Create a `/profile` or `/profile/:username` page displaying creator stats (followers, total tips earned), a grid of uploaded videos, and a billing settings tab.

---

## 2. Implementation Roadmap & Action Checklist

### Phase 1: Connect Top-Up Workspace (Deposit Navigation)
- [x] Add `cursor-pointer hover:underline` states to balance labels.
- [x] Bind `onClick={() => router.push('/deposit')}` (or `Link` wrapper) on the desktop sidebar and mobile header balance readouts.

### Phase 2: Action Sidebar Integrations
- [x] **Follow API Integration**:
  * Implement follow/unfollow route on the backend.
  * Implement client action to optimistically check follow status.
- [x] **Web Share & Clipboard API**:
  * Create a utility to copy links to the clipboard.
  * Implement standard Web Share payload (Title: Video Title, Text: Description, URL: Video Stream Link).
- [x] **Following vs. For You Feed Filters**:
  * Build dynamic following query parameter into Zustand fetch request.
  * Wire active tab states and query triggers on click.

### Phase 3: Secondary Feed Views (Inbox, Profile, Discover Pages)
- [ ] **Discover View**:
  * Build a basic discover page layout utilizing existing grid layouts.
- [ ] **Inbox View**:
  * Setup a stateful inbox list fetching user-specific transactions and notification messages.
- [ ] **Profile View**:
  * Integrate user profile stats and query creator-specific videos `GET /api/feed?creatorId=xyz`.

---

## 3. Recommended Code Adjustments

### 3.1 Balance Top-Up Links (`VideoFeed.tsx`)
Wrap the desktop and mobile wallet balance tags inside a `<Link>` or trigger route updates:
```tsx
// Desktop Sidebar (Line 61)
<Link 
  href="/deposit"
  className="flex justify-between items-center text-xs mt-1 text-cloud-white/60 hover:text-cloud-white font-mono cursor-pointer transition-colors"
>
  <span>Wallet:</span>
  <span className="font-bold text-fintech-mint hover:underline">ZAR {mongooseUser?.walletBalance.toFixed(2)}</span>
</Link>

// Mobile Header (Line 128)
<Link 
  href="/deposit" 
  className="flex flex-col items-end gap-0.5 max-w-[80px] cursor-pointer hover:opacity-80 transition-opacity"
>
  <span className="text-[10px] font-black text-cloud-white truncate">@{mongooseUser?.username}</span>
  <span className="text-[9px] font-mono text-fintech-mint font-bold hover:underline">Z{mongooseUser?.walletBalance}</span>
</Link>
```

### 3.2 Share Button Handler (`VideoFeed.tsx`)
```tsx
const handleShare = async (video: Video) => {
  const shareData = {
    title: video.title,
    text: video.description,
    url: video.videoUrl
  };
  
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      console.log('Video shared successfully');
    } catch (err) {
      console.log('Error sharing:', err);
    }
  } else {
    // Clipboard copy fallback
    try {
      await navigator.clipboard.writeText(video.videoUrl);
      alert('Video link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }
};
```
