---
name: Advanced TypeScript Compilation & Typing
description: Strict-mode TypeScript compilation, type safety rules, and anti-patterns.
---

# Skill: Advanced TypeScript Compilation & Typing

## Context & Versioning
- Mode: TypeScript Strict Mode (`strict: true`)

## Engineering Standards

### 1. Anti-Patterns & Banned Expressions
- `any` is explicitly banned. If a data type is generic or unknown, default cleanly to `unknown` and apply target data Type Guards.
- Non-null assertions (`!`) are forbidden unless verifying absolute edge invariants. Prefer optional chaining (`?.`) or structural fallbacks.

### 2. Strict Type Safety Rules
- Turn on `noImplicitAny`, `strictNullChecks`, and `noUnusedLocals` in the local application project.
- Every API route and endpoint payload model must provide explicit TypeScript request mapping interfaces.
