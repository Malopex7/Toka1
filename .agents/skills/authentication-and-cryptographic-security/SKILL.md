---
name: Authentication and Cryptographic Security
description: Engineering standards, JWT lifecycle management, password hashing, and middleware pipeline design.
---

# Skill: Authentication and Cryptographic Security

## Context & Versioning
- Pattern: Stateless JSON Web Tokens (JWT)
- Encryption: bcryptjs

## Engineering Standards

### 1. Cryptographic Security Engine
- Password hashes must be created using `bcryptjs` using a salt work factor of exactly `10`.
- Cryptographic comparisons must utilize async evaluations (`bcrypt.compare`) to prevent timing-attack exploits blocker blocks.

### 2. JWT Strategy & Lifecycle
- Tokens must be split between a transient short-lived token (Access Token, e.g., 15 minutes) and a secure HTTP-Only cookie storage engine (Refresh Token).
- Access tokens must carry minimum necessary claims (`userId`, `roles`). Do not dump large user payload dictionaries into the cryptographic signatures.

### 3. Middleware Pipeline Design
Secure routes by composing sequential verification chains:
1. Extraction pipeline (Reads authorization bearer header or cookie parameters).
2. Verification pipeline (Executes validation check against secret string environment variables).
3. Context Hydration pipeline (Binds validated claims cleanly to `req.user` payload maps).
