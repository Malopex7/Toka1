---
name: Modern Node Backend (Express 5 & Mongoose)
description: Engineering standards, route configuration, and database connection guidelines for Express 5 and Mongoose 8.
---

# Skill: Modern Node Backend (Express 5 & Mongoose)

## Context & Versioning
- Runtime: Node.js 18+ / 20+
- Framework: Express 5.x (Stable)
- ODM: Mongoose 8+ / MongoDB Atlas

## Engineering Standards

### 1. Express 5 Native Promise Error Handling
Express 5 natively catches rejected promises in routes and middleware. You no longer need manual `try/catch` wrappers or third-party wrappers to forward async runtime exceptions to global error handlers.

```typescript
import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// Express 5 cleanly catches the thrown error or rejected promise automatically
router.get('/user/:id', async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new Error('User not found'); 
  res.json(user);
});
```

### 2. Route Parameter Rigor & Strict Queries
- Express 5 changes path matching behavior: regular expression strings are dropped; wildcard path params must explicitly match formatting hooks.
- `req.query` is strictly read-only. Do not attempt mutations.
- Deprecated Express 4 helper signatures are completely omitted (e.g., lower-case `res.sendfile()` is invalid; use capitalized `res.sendFile()`).

### 3. Mongoose 8 Connections & Schemas
- Never invoke global database connections repeatedly. Instantiate a single cached database connector.
- Always apply strict schema configurations, virtual transformations, index hooks, and explicit TypeScript Interfaces matching Mongoose Document variants.
