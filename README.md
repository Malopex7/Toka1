# 🚀 MERN + Next.js Startup Template

Welcome to your ultimate full-stack startup template. This repository is pre-configured and structured to help you bootstrap and launch new applications in record time, using a modern tech stack, best practices, and automated workflows.

## 🏗️ Architecture & Tech Stack

This project is a monorepo-style setup split into two main components:

### 💻 Frontend (`/frontend`)

- **Framework:** Next.js 16 (using the modern App Router architecture under `src/app/`)
- **React version:** React 19
- **Language:** TypeScript 5 (Strict Mode enabled)
- **Styling:** Tailwind CSS v4
- **UI & Components:** shadcn/ui (supporting Radix UI or Base UI primitives, with customizable icon libraries)
- **State Management:** Zustand v5
- **Tooling:** ESLint 9

### ⚙️ Backend (`/backend`)

- **Runtime:** Node.js
- **Framework:** Express 5.1.x (native support for unhandled async rejections)
- **Database ORM:** Mongoose 8.16.x (MongoDB integration)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) & secure password hashing (`bcryptjs`)
- **Module System:** ES Modules (`"type": "module"`)

---

## 📂 Project Structure

```
├── .agents/             # Custom AI agent skills and configurations
├── .clinerules/         # Project-specific AI coding guidelines and rules
├── .github/             # GitHub Actions CI workflows
│   └── workflows/
│       └── ci.yml
├── backend/             # Express 5 backend API server
│   ├── src/             # Express source code
│   │   ├── index.js     # Entry point
│   │   └── middlewares/ # Custom Express middlewares (error handling)
│   ├── package.json     # Node scripts & dependencies
│   └── package-lock.json
├── docs/                # Project documentation and resources
│   └── prompt.md
└── frontend/            # Next.js 16 frontend application
    ├── public/          # Static assets
    ├── src/             # Next.js App Router source code
    │   ├── app/         # Pages, layouts, globals.css, favicon
    │   ├── components/  # React components (including shadcn UI components)
    │   ├── lib/         # Utility functions (utils.ts)
    │   └── store.ts     # Zustand state store
    ├── components.json  # shadcn/ui configuration
    ├── eslint.config.mjs# ESLint 9 configuration (flat config)
    ├── next.config.ts   # Next.js configuration
    ├── postcss.config.mjs # PostCSS configuration
    ├── package.json     # Next.js scripts & dependencies
    ├── package-lock.json
    └── tsconfig.json    # TypeScript configuration
```

---

## 🚀 Getting Started

Follow these steps to get your local development environment up and running.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org) (v20+ recommended) and `npm` installed.

### 1. Set Up Environment Variables

#### Backend Setup

1. Navigate to `/backend`
2. Create a `.env` file (e.g. copied from your environment template or created manually):
   ```bash
   # Example backend configuration:
   PORT=5001
   MONGO_URI=it is in .env
   JWT_SECRET=it is in .env
   ```

#### Frontend Setup

1. Navigate to `/frontend`
2. Create a `.env.local` file:
   ```bash
   # Example frontend configuration:
   NEXT_PUBLIC_API_URL=http://localhost:5001
   ```

---

### 2. Install Dependencies & Run Development Servers

#### Running Backend

Navigate to `backend/`:

```bash
cd backend
npm install
npm run dev
```

The backend server runs by default on `http://localhost:5000` (or the port defined in `PORT`, e.g., `http://localhost:5001` if using the example configuration above) with hot-reloading powered by `nodemon`.

#### Running Frontend

Navigate to `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

The Next.js development server runs by default on `http://localhost:3000`.

---

## 🛡️ Continuous Integration (CI)

A GitHub Actions workflow is pre-configured in `.github/workflows/ci.yml`. On every push and pull request to `main` or `master`, the workflow:

- Lints the backend and frontend codebases.
- Verifies typescript compilation on the Next.js frontend (`tsc --noEmit`).
- Runs backend tests.
- Performs build checks on both frontend and backend.
