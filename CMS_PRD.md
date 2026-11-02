# Product Requirements Document
## Internal CMS — Lead Management with Role-Based Access Control

**Project:** Internal CMS  
**Stack:** Next.js (App Router), MongoDB (Mongoose), NextAuth.js  
**Version:** 1.0.0  
**Date:** 2026-11-02  
**Prepared by:** Cyfer Solutions LLP

---

## 1. Overview

An internal CMS for managing sales leads with full role-based access control (RBAC). The system allows authorised users to create, view, update, and delete leads. Administrators can define roles and assign granular permissions to control what each role can do. One super-admin account is seeded at startup and cannot be deleted or demoted.

---

## 2. Goals

- Centralise lead data for the internal sales/BD team.
- Enforce strict RBAC so junior staff can only view/add, not modify or delete.
- Provide a clean, fast UI using Next.js App Router with server components where possible.
- Keep auth stateless and secure using NextAuth.js with JWT sessions.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Database | MongoDB via Mongoose |
| Auth | NextAuth.js v5 (Auth.js) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Validation | Zod |
| Password Hashing | bcryptjs |
| Session Strategy | JWT (stored in HTTP-only cookie) |

---

## 4. Data Models

### 4.1 User

```ts
// models/User.ts
{
  _id: ObjectId,
  name: string,               // required
  email: string,              // required, unique, lowercase
  password: string,           // hashed with bcryptjs
  role: ObjectId,             // ref: Role
  isSuperAdmin: boolean,      // default: false — only seeded user is true
  isActive: boolean,          // default: true
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 Role

```ts
// models/Role.ts
{
  _id: ObjectId,
  name: string,               // required, unique, e.g. "Sales Agent", "Manager"
  permissions: string[],      // array of permission keys (see Section 5.2)
  isSystem: boolean,          // true only for "Super Admin" — undeletable
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 Lead

```ts
// models/Lead.ts
{
  _id: ObjectId,
  name: string,               // required, full name
  email: string,              // required, unique
  phone: string,              // required
  address: {
    street: string,           // required
    city: string,             // required
    country: string,          // required
    postalCode: string        // required
  },
  roofSize: number,           // required, in sq ft
  notes: string,              // optional free text
  status: enum[
    "new",
    "contacted",
    "qualified",
    "lost",
    "converted"
  ],                          // default: "new"
  assignedTo: ObjectId,       // ref: User, optional
  createdBy: ObjectId,        // ref: User, set on create
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. RBAC Design

### 5.1 Permission Keys

All permissions follow the format `resource:action`. The full permission list:

```
leads:view
leads:create
leads:edit
leads:delete
leads:export

roles:view
roles:create
roles:edit
roles:delete

users:view
users:create
users:edit
users:delete
```

### 5.2 Super Admin

- Has all permissions by definition — not stored in the permissions array but enforced in guards.
- `isSuperAdmin: true` on the user document.
- The Super Admin role cannot be deleted or edited via the UI.
- The Super Admin user cannot be deleted or have their role changed.

### 5.3 Seeded Data

At startup (`/scripts/seed.ts`) the following is created if it does not already exist:

**Role:**
```json
{
  "name": "Super Admin",
  "permissions": [],
  "isSystem": true
}
```

**User:**
```json
{
  "name": "Super Admin",
  "email": "superadmin@cms.internal",
  "password": "<bcrypt hash of SUPER_ADMIN_PASSWORD env var>",
  "isSuperAdmin": true
}
```

---

## 6. Authentication

### 6.1 NextAuth.js Configuration

File: `auth.ts` (project root)

- Provider: `CredentialsProvider` (email + password).
- Session strategy: `jwt`.
- JWT encodes `userId`, `email`, `roleId`, `isSuperAdmin`.
- Session callback populates `session.user` with the same fields.
- `signIn` callback fetches the user, verifies password with `bcryptjs.compare`, checks `isActive`.

```ts
// auth.ts (simplified shape)
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        // 1. Find user by email
        // 2. Compare password
        // 3. Check isActive
        // 4. Return { id, name, email, roleId, isSuperAdmin }
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId      = user.id
        token.roleId      = user.roleId
        token.isSuperAdmin = user.isSuperAdmin
      }
      return token
    },
    session({ session, token }) {
      session.user.userId       = token.userId
      session.user.roleId       = token.roleId
      session.user.isSuperAdmin = token.isSuperAdmin
      return session
    }
  },
  pages: {
    signIn: "/login"
  }
})
```

---

## 7. Middleware Guarding

### 7.1 Next.js Middleware (`middleware.ts`)

Runs on the Edge before any page or API route is served. This is the first line of defence.

```ts
// middleware.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p))

  // 1. Unauthenticated user hitting protected route -> redirect to /login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 2. Authenticated user hitting /login -> redirect to /dashboard
  if (session && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
```

This handles:
- Unauthenticated redirects globally.
- Prevents authenticated users from seeing the login page.
- Static assets and Next.js internals are excluded.

---

## 8. Server-Side Permission Guards (API Routes)

### 8.1 `withAuth` Helper

A reusable wrapper for all API Route Handlers (`app/api/**/route.ts`) that:
1. Verifies the session exists.
2. Fetches the user and their role from MongoDB.
3. Checks the required permission(s).
4. Returns a 401/403 early if checks fail.

```ts
// lib/api-guards.ts
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { getUserWithRole } from "@/lib/db/users"

type Handler = (
  req: NextRequest,
  context: { params: Record<string, string> },
  user: AuthUser
) => Promise<NextResponse>

export function withAuth(requiredPermission: string | null, handler: Handler) {
  return async (
    req: NextRequest,
    context: { params: Record<string, string> }
  ) => {
    const session = await auth()

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
    }

    const user = await getUserWithRole(session.user.userId)

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Account not found or inactive" }, { status: 401 })
    }

    // Super admin bypasses all permission checks
    if (!user.isSuperAdmin && requiredPermission) {
      const userPermissions: string[] = user.role?.permissions ?? []
      if (!userPermissions.includes(requiredPermission)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return handler(req, context, user)
  }
}
```

### 8.2 Usage in API Routes

```ts
// app/api/leads/route.ts
import { withAuth } from "@/lib/api-guards"

// GET /api/leads — requires leads:view
export const GET = withAuth("leads:view", async (req, _ctx, user) => {
  const leads = await getLeads()
  return NextResponse.json(leads)
})

// POST /api/leads — requires leads:create
export const POST = withAuth("leads:create", async (req, _ctx, user) => {
  const body = await req.json()
  const validated = LeadSchema.parse(body)
  const lead = await createLead({ ...validated, createdBy: user._id })
  return NextResponse.json(lead, { status: 201 })
})
```

```ts
// app/api/leads/[id]/route.ts

export const PUT    = withAuth("leads:edit",   updateLeadHandler)
export const DELETE = withAuth("leads:delete", deleteLeadHandler)
```

```ts
// app/api/roles/route.ts
export const GET  = withAuth("roles:view",   getRolesHandler)
export const POST = withAuth("roles:create", createRoleHandler)

// app/api/roles/[id]/route.ts
export const PUT    = withAuth("roles:edit",   updateRoleHandler)
export const DELETE = withAuth("roles:delete", deleteRoleHandler)
```

Additional guard inside role delete handler — prevent deleting system roles:
```ts
if (role.isSystem) {
  return NextResponse.json(
    { error: "System roles cannot be deleted" },
    { status: 403 }
  )
}
```

---

## 9. Client-Side AppGuard Context

### 9.1 Purpose

The AppGuard provides the client-side permission context so UI elements (buttons, nav items, entire pages) conditionally render based on the logged-in user's permissions. It does NOT replace server guards — it is cosmetic protection only.

### 9.2 AppGuardProvider

```ts
// context/AppGuard.tsx
"use client"

import { createContext, useContext, ReactNode } from "react"
import { useSession } from "next-auth/react"

// ---- Types ----

export type Permission =
  | "leads:view"   | "leads:create"  | "leads:edit"   | "leads:delete"  | "leads:export"
  | "roles:view"   | "roles:create"  | "roles:edit"   | "roles:delete"
  | "users:view"   | "users:create"  | "users:edit"   | "users:delete"

interface AppGuardContextValue {
  isSuperAdmin: boolean
  permissions: Permission[]
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAll: (permissions: Permission[]) => boolean
  isReady: boolean
}

// ---- Context ----

const AppGuardContext = createContext<AppGuardContextValue | null>(null)

// ---- Provider ----

export function AppGuardProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()

  const isSuperAdmin = session?.user?.isSuperAdmin ?? false
  const permissions: Permission[] = (session?.user?.permissions ?? []) as Permission[]
  const isReady = status !== "loading"

  const can = (permission: Permission): boolean => {
    if (isSuperAdmin) return true
    return permissions.includes(permission)
  }

  const canAny = (perms: Permission[]): boolean => {
    if (isSuperAdmin) return true
    return perms.some((p) => permissions.includes(p))
  }

  const canAll = (perms: Permission[]): boolean => {
    if (isSuperAdmin) return true
    return perms.every((p) => permissions.includes(p))
  }

  return (
    <AppGuardContext.Provider
      value={{ isSuperAdmin, permissions, can, canAny, canAll, isReady }}
    >
      {children}
    </AppGuardContext.Provider>
  )
}

// ---- Hook ----

export function useAppGuard(): AppGuardContextValue {
  const ctx = useContext(AppGuardContext)
  if (!ctx) {
    throw new Error("useAppGuard must be used inside <AppGuardProvider>")
  }
  return ctx
}
```

### 9.3 Mounting the Provider

```tsx
// app/layout.tsx
import { SessionProvider } from "next-auth/react"
import { AppGuardProvider } from "@/context/AppGuard"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <AppGuardProvider>
            {children}
          </AppGuardProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

### 9.4 Guard Components

```tsx
// components/guards/PermissionGate.tsx
"use client"

import { useAppGuard, Permission } from "@/context/AppGuard"

interface PermissionGateProps {
  require: Permission | Permission[]
  mode?: "any" | "all"
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGate({
  require,
  mode = "any",
  fallback = null,
  children
}: PermissionGateProps) {
  const { can, canAny, canAll, isReady } = useAppGuard()

  if (!isReady) return null

  const perms = Array.isArray(require) ? require : [require]
  const allowed = perms.length === 1
    ? can(perms[0])
    : mode === "all"
      ? canAll(perms)
      : canAny(perms)

  return allowed ? <>{children}</> : <>{fallback}</>
}
```

### 9.5 Page-Level Guard (Server Component wrapper)

For full page protection on the server side, use this pattern in each protected layout or page:

```tsx
// app/(dashboard)/leads/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getUserWithRole } from "@/lib/db/users"

export default async function LeadsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const user = await getUserWithRole(session.user.userId)

  const canView =
    user.isSuperAdmin ||
    user.role?.permissions?.includes("leads:view")

  if (!canView) redirect("/dashboard?error=forbidden")

  return <LeadsView />
}
```

---

## 10. Permissions in the Session

To make permissions available client-side via `useAppGuard`, populate them during JWT/session callbacks:

```ts
// auth.ts — extended callbacks
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.userId       = user.id
      token.isSuperAdmin = user.isSuperAdmin
      token.roleId       = user.roleId
    }
    // Refresh permissions on every token refresh or on sign-in
    if (trigger === "signIn" || trigger === "update") {
      const dbUser = await getUserWithRole(token.userId as string)
      token.permissions = dbUser?.isSuperAdmin
        ? ALL_PERMISSIONS           // constant with every permission key
        : (dbUser?.role?.permissions ?? [])
    }
    return token
  },
  session({ session, token }) {
    session.user.userId       = token.userId
    session.user.isSuperAdmin = token.isSuperAdmin
    session.user.roleId       = token.roleId
    session.user.permissions  = token.permissions
    return session
  }
}
```

---

## 11. Features — Functional Requirements

### 11.1 Authentication

| # | Requirement |
|---|---|
| F-01 | User can log in with email and password. |
| F-02 | Invalid credentials show an error message. |
| F-03 | Inactive accounts are rejected at login. |
| F-04 | Session expires after 8 hours of inactivity. |
| F-05 | User can log out. JWT is invalidated client-side. |

### 11.2 Lead Management

| # | Requirement | Permission Required |
|---|---|---|
| F-10 | View paginated list of leads with search + filter by status | `leads:view` |
| F-11 | View single lead detail page | `leads:view` |
| F-12 | Add new lead (name, email, phone, address fields, roof size, status, notes) | `leads:create` |
| F-13 | Edit existing lead | `leads:edit` |
| F-14 | Delete lead (with confirmation modal) | `leads:delete` |
| F-15 | Export leads as CSV | `leads:export` |
| F-16 | Assign lead to a user | `leads:edit` |

Address sub-fields captured on create/edit:
- Street Address
- City
- Country
- Postal Code

Roof Size: numeric input, stored in sq ft, optional unit toggle (sq ft / sq m) with conversion on the frontend.

### 11.3 Role Management

| # | Requirement | Permission Required |
|---|---|---|
| F-20 | View list of all roles | `roles:view` |
| F-21 | Create new role and assign permissions from the full permission list | `roles:create` |
| F-22 | Edit role name and permissions | `roles:edit` |
| F-23 | Delete role (blocked if any user is assigned to it, or if `isSystem: true`) | `roles:delete` |

### 11.4 User Management

| # | Requirement | Permission Required |
|---|---|---|
| F-30 | View list of all users | `users:view` |
| F-31 | Create new user and assign a role | `users:create` |
| F-32 | Edit user name, email, role, active status | `users:edit` |
| F-33 | Deactivate / reactivate user | `users:edit` |
| F-34 | Delete user (blocked for Super Admin user) | `users:delete` |

Super Admin user has additional protections enforced at API level:
- Cannot be deleted.
- Cannot have `isSuperAdmin` changed.
- Cannot be deactivated.

---

## 12. API Endpoints

### Auth
```
POST   /api/auth/[...nextauth]   — NextAuth handler (sign-in, sign-out, session)
```

### Leads
```
GET    /api/leads                — list leads (paginated, filterable)
POST   /api/leads                — create lead
GET    /api/leads/:id            — get single lead
PUT    /api/leads/:id            — update lead
DELETE /api/leads/:id            — delete lead
GET    /api/leads/export         — CSV export
```

### Roles
```
GET    /api/roles                — list roles
POST   /api/roles                — create role
GET    /api/roles/:id            — get single role
PUT    /api/roles/:id            — update role
DELETE /api/roles/:id            — delete role
```

### Users
```
GET    /api/users                — list users
POST   /api/users                — create user
GET    /api/users/:id            — get single user
PUT    /api/users/:id            — update user
DELETE /api/users/:id            — delete user
```

---

## 13. Folder Structure

```
/
├── app/
│   ├── layout.tsx                   # RootLayout — SessionProvider + AppGuardProvider
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx             # Public login page
│   └── (dashboard)/
│       ├── layout.tsx               # Dashboard shell — server auth check
│       ├── dashboard/
│       │   └── page.tsx
│       ├── leads/
│       │   ├── page.tsx             # Server guard: leads:view
│       │   ├── new/
│       │   │   └── page.tsx         # Server guard: leads:create
│       │   └── [id]/
│       │       ├── page.tsx         # view
│       │       └── edit/
│       │           └── page.tsx     # Server guard: leads:edit
│       ├── roles/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/edit/page.tsx
│       └── users/
│           ├── page.tsx
│           ├── new/page.tsx
│           └── [id]/edit/page.tsx
│
├── app/api/
│   ├── auth/[...nextauth]/route.ts
│   ├── leads/
│   │   ├── route.ts                 # GET, POST
│   │   ├── export/route.ts          # GET CSV
│   │   └── [id]/route.ts            # GET, PUT, DELETE
│   ├── roles/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── users/
│       ├── route.ts
│       └── [id]/route.ts
│
├── components/
│   ├── guards/
│   │   └── PermissionGate.tsx       # Client permission wrapper component
│   ├── leads/
│   │   ├── LeadForm.tsx
│   │   ├── LeadTable.tsx
│   │   └── LeadStatusBadge.tsx
│   ├── roles/
│   │   ├── RoleForm.tsx
│   │   └── PermissionsCheckboxGrid.tsx
│   ├── users/
│   │   └── UserForm.tsx
│   └── ui/                          # shadcn/ui components
│
├── context/
│   └── AppGuard.tsx                 # AppGuardProvider + useAppGuard + types
│
├── lib/
│   ├── api-guards.ts                # withAuth() wrapper for API routes
│   ├── db/
│   │   ├── connect.ts               # Mongoose singleton connection
│   │   ├── leads.ts                 # Lead CRUD helpers
│   │   ├── roles.ts                 # Role CRUD helpers
│   │   └── users.ts                 # User CRUD helpers (getUserWithRole etc.)
│   ├── permissions.ts               # ALL_PERMISSIONS constant
│   └── validations/
│       ├── lead.schema.ts           # Zod schema for Lead
│       ├── role.schema.ts
│       └── user.schema.ts
│
├── models/
│   ├── Lead.ts
│   ├── Role.ts
│   └── User.ts
│
├── scripts/
│   └── seed.ts                      # Seeds Super Admin role + user
│
├── types/
│   └── next-auth.d.ts               # Augment Session/JWT with custom fields
│
├── auth.ts                          # NextAuth config
├── middleware.ts                    # Edge middleware — auth redirect guard
└── .env.local                       # MONGODB_URI, NEXTAUTH_SECRET, SUPER_ADMIN_PASSWORD
```

---

## 14. Environment Variables

```env
# .env.local

MONGODB_URI=mongodb://localhost:27017/cms-internal
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Used only by seed script
SUPER_ADMIN_PASSWORD=changeme_on_first_run
```

---

## 15. TypeScript Augmentations

```ts
// types/next-auth.d.ts
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      userId: string
      name: string
      email: string
      roleId: string
      isSuperAdmin: boolean
      permissions: string[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    roleId: string
    isSuperAdmin: boolean
    permissions: string[]
  }
}
```

---

## 16. Security Checklist

| # | Check |
|---|---|
| S-01 | All API routes wrapped in `withAuth()` — no unguarded endpoints. |
| S-02 | Middleware catches unauthenticated requests at the Edge before any logic runs. |
| S-03 | Server components re-check auth via `auth()` and do NOT rely on client state. |
| S-04 | PermissionGate is cosmetic only — it never substitutes for server checks. |
| S-05 | Passwords hashed with bcrypt, cost factor 12+. |
| S-06 | JWT stored in HTTP-only, Secure, SameSite=Lax cookie by NextAuth. |
| S-07 | Super Admin user and role are immutable via API guards. |
| S-08 | System roles cannot be deleted. |
| S-09 | Roles assigned to active users cannot be deleted. |
| S-10 | Zod validates all inbound API payloads before they touch the database. |
| S-11 | MongoDB queries use typed Mongoose models, no raw string injection. |
| S-12 | `NEXTAUTH_SECRET` must be a cryptographically random 32-byte value in production. |

---

## 17. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Lead list page loads in under 2 seconds for up to 10,000 records (with pagination, indexed fields). |
| Scalability | MongoDB indexes on `leads.email`, `leads.status`, `leads.createdAt`, `users.email`. |
| Accessibility | WCAG AA compliant UI via shadcn/ui defaults. |
| Browser Support | Latest 2 versions of Chrome, Firefox, Edge, Safari. |
| Mobile | Responsive layout down to 375px viewport. |

---

## 18. Milestones

| Sprint | Scope |
|---|---|
| Sprint 1 | Project scaffolding, DB models, seed script, auth (login/logout), middleware. |
| Sprint 2 | Lead CRUD (API + UI), server-side permission guards. |
| Sprint 3 | Role management (API + UI), permission assignment UI. |
| Sprint 4 | User management (API + UI), AppGuard context, PermissionGate components. |
| Sprint 5 | CSV export, polish, testing, deployment hardening. |

---

*End of Document*
