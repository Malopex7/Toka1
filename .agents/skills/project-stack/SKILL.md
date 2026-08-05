---
name: Project Tech Stack & Guidelines
description: Guidelines, conventions, and tech stack details for this MERN/Next.js full-stack repository.
---

# Project Tech Stack & Guidelines

This document outlines the global rules, conventions, and tech stack for this full-stack repository. These guidelines should be strictly followed when writing or modifying code.

## 🏗️ Project Structure

The repository is divided into two main applications:

- `/frontend` - Next.js 16 web application
- `/backend` - Node.js & Express 5 API server

---

## 💻 Frontend (`/frontend`)

### Core Tech Stack

- **Framework:** Next.js 16 (App Router is the default architecture)
- **Library:** React 19
- **Language:** TypeScript 5 (Strict mode enabled)
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (supporting Radix UI or Base UI primitives, with customizable icon libraries)
- **State Management:** Zustand v5
- **Tooling:** ESLint 9

### Frontend Best Practices

1. **Next.js App Router Next 16:**
   - Use the `app/` directory structure under `src/app/`.
   - Leverage React Server Components (RSC) by default for better performance and SEO.
   - Use the `"use client"` directive only when necessary (e.g., for event listeners, React hooks, or browser APIs).
   - Use Next.js 16 routing, layouts, and loading/error boundaries appropriately.

2. **TypeScript & Types:**
   - Ensure strict typing. Avoid `any`.
   - Use absolute imports using the `@/` alias or subpath imports (e.g., `#/*` mapped in `package.json#imports`) for cleaner module paths.

3. **Styling & UI (Tailwind v4 & shadcn/ui):**
   - Use utility-first Tailwind CSS for styling. Prefer modern OKLCH color spaces in the theme configuration.
   - For complex, reusable UI components, adhere to the `shadcn/ui` pattern using `cva` (class-variance-authority), `clsx`, and `tailwind-merge`.
   - Support React 19 standards: do not wrap primitives in legacy `forwardRef`; directly pass and accept `ref` as a prop.
   - Prioritize pre-assembled "Blocks" for dashboard sections and complex layouts instead of manual page construction from individual elements.

4. **State Management (Zustand):**
   - Keep stores atomic and modular.
   - Only use Zustand when state needs to be shared across disparate parts of the component tree or when prop drilling becomes unreasonable. React context/local state is sufficient for transient component state.

---

## ⚙️ Backend (`/backend`)

### Core Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5.1.x
- **Database ORM:** Mongoose 8.16.x (MongoDB)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) & password hashing (`bcryptjs`)
- **Module System:** ES Modules (`"type": "module"`)

### Backend Best Practices

1. **ES Modules Syntax:**
   - Use `import` and `export` statements instead of `require()`. Ensure appropriate `.js` extensions in local imports if not using a bundler that resolves them automatically.

2. **Express 5 Features:**
   - Express 5 behaves better with unhandled promise rejections. You can write generic async route handlers without needing third-party wrapper libraries like `express-async-handler` for basic error handling, though standard error middlewares should still be configured.

3. **Mongoose Models:**
   - Define clean schemas and handle model types carefully.
   - Utilize Mongoose hooks (pre/post save) where appropriate, e.g., for hashing passwords before saving user documents.

4. **Authentication (`jwt` + `bcryptjs`):**
   - Always hash passwords using `bcryptjs` before persisting to MongoDB.
   - Use environment variables (`dotenv`) for storing JWT secrets.
   - Implement protected routes using custom middleware that verifies the JWT from headers or cookies.

5. **Structure:**
   - Separate concerns logically (e.g., `src/routes`, `src/controllers`, `src/models`, `src/middlewares`).
   - Entry point is `src/index.js`. Development server runs via `nodemon`.

---

## 🌍 General Rules

- Keep environment-specific settings out of source control. Always rely on `.env` on backend and `.env.local` on frontend.
- Maintain a clean Git history and ensure no sensitive data (like `node_modules` or `.env` files) is committed (handled by `.gitignore`).
- Add descriptive code comments for complex business logic, but prioritize writing self-documenting code with meaningful variable and function names.
