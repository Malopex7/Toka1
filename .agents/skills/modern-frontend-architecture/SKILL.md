---
name: Modern Frontend Architecture (Next.js 15 & React 19)
description: Engineering standards, versioning, and best practices for Next.js 15, React 19, and Zustand 5.
---

# Skill: Modern Frontend Architecture (Next.js 15 & React 19)

## Context & Versioning
- Framework: Next.js 15+ (App Router enforced)
- Library: React 19+ (Stable)
- State Management: Zustand 5+
- Compiler: TypeScript Strict Mode Enforced

## Engineering Standards

### 1. Next.js 15 Asynchronous Request APIs
In Next.js 15, dynamic APIs like `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous promises. Always await them before accessing properties.
```tsx
// Correct Implementation
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <main>ID: {id}</main>;
}
```

### 2. React 19 Forms & Server Actions
- Use native React 19 hooks: `useActionState` (replacing the deprecated `useFormState`) and `useFormStatus`.
- Prefer the built-in Next.js 15 `<Form>` component from `next/form` for prefetching search mutations.
- Keep Server Actions typed and secure; validate payloads using Zod inside actions.

### 3. Client vs. Server Components
- **Default to Server Components (RSC):** Fetch data, fetch database records, and handle secrets directly in Server Components.
- **Client Components ('use client'):** Restrict strictly to components utilizing Zustand hooks, browser events, or state hooks (`useState`, `useEffect`).

### 4. Zustand State Management
- Never instantiate a Zustand store globally in an App Router context if it contains mutation states that can leak across concurrent server requests.
- Create local stores or pass down single-instance contexts where multi-user isolation is critical.
```typescript
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```
