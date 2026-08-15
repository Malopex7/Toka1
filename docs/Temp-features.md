1. Auto-Complete & Search Dropdown (Mentions Input)
What it does: As creators type @username in the 

UploadModal.tsx
 title/description field, a dropdown dynamically queries the database and suggests matching users (prioritizing followed/following users).
Why it fits: It aligns with standard user expectations on social networks and prevents spelling errors.
Technical Fit: We can implement a simple user-search endpoint in 

userRoutes.js
 and integrate a clean popover menu in the frontend's upload form.
2. Co-Authors & Collaborative Posting
What it does: Tagging a creator invites them to be a co-author. If they accept, the video automatically displays on both profiles' feeds.
Why it fits: Speeds up content discovery and virality.
Technical Fit: We can add a collaborators array field to the 

Video.js
 model.
3. Collaborative Revenue & Tip Splitting
What it does: Since Toka already supports user wallets (

User.js
), any tips/donations or brand sponsorships earned on the post can be split automatically (e.g., 50/50) between the owner and the tagged collaborator.
Why it fits: Strongly incentivizes collaboration.
Technical Fit: Integrate with the transaction creation service to calculate and divide the payouts.
4. Tag Requests & Approval Flow
What it does: Rather than immediately showing the tag on the video, the tagged creator receives an in-app and push notification request. The tag only becomes active and clickable once they approve it.
Why it fits: Prevents tagging spam and gives creators complete control over their brand/profile.
Technical Fit: Add a new notification type in 

Notification.js
 and a state field on the video's tagged users metadata.
5. Direct Brand Sponsorship Tagging
What it does: When uploading and choosing the Brand Sponsorship tier, creators can search and tag registered Brand accounts to request sponsorship directly.
Why it fits: Integrates the posting flow with the advertising pipeline.
Technical Fit: The upload form prompts brand selection if the brand_safe tier is selected.