# Internal CMS Implementation Plan

This plan turns the requirements in [CMS_PRD.md](./CMS_PRD.md) into an ordered, testable implementation using Next.js App Router, TypeScript, MongoDB/Mongoose, Auth.js (NextAuth.js v5), Tailwind CSS, shadcn/ui, and Zod.

## Guiding decisions

- Implement and verify the server-side authorization path before relying on client-side permission-aware UI. Client guards improve the experience but are never security boundaries.
- Keep Mongoose connections and database-dependent code out of Edge middleware. Middleware handles session redirects; server components and API handlers perform fresh account and permission checks.
- Derive the acting user from the verified session and database, never from request-body fields such as `createdBy`, `isSuperAdmin`, or trusted role permissions.
- Treat the seeded Super Admin and system role as protected invariants in database operations, not just disabled controls in the UI.
- Keep secrets in environment configuration; commit only a `.env.example` with placeholders, never real credentials.

## Step-by-step plan

### 1. Confirm requirements and scaffold the application

- Review the PRD and confirm the implementation scope: authentication, lead management, role management, user management, CSV export, responsive UI, and deployment hardening.
- Scaffold a Next.js App Router project with TypeScript, Tailwind CSS, and the agreed package manager. Add shadcn/ui and initialize only the UI components the application needs.
- Establish the app route groups for authentication and the dashboard, and configure the `@/` import alias.
- Add formatting, lint, type-check, and test commands; add a minimal CI workflow if the repository has CI conventions to follow.
- Add `.env.example` for `MONGODB_URI`, `AUTH_SECRET`/the Auth.js secret, and `SUPER_ADMIN_PASSWORD`; ensure real `.env*` files are ignored.

**Verify:** A clean install, development server, production build, lint, and type-check all work before feature development proceeds.

### 2. Define shared domain types, permissions, and validation

- Define the complete permission-key list once and reuse it in API authorization, role forms, session typing, and client UI.
- Define shared lead status and domain types, including the nested address and optional assignment.
- Write Zod schemas for create/update operations for leads, roles, and users. Validate route parameters, pagination, search, filters, and CSV query options as well as JSON bodies.
- Separate create and update schemas where requirements differ; do not allow clients to set protected fields such as IDs, timestamps, `createdBy`, `isSuperAdmin`, or system-role status.
- Add NextAuth Session/JWT type augmentation and agree on consistent error response shapes.

**Verify:** Unit tests cover valid and invalid payloads, enum values, required fields, normalization, and rejection of protected fields.

### 3. Implement MongoDB connection and Mongoose models

- Add a reusable Mongoose connection helper suitable for Next.js development hot reload and serverless reuse.
- Implement User, Role, and Lead models with required fields, defaults, references, timestamps, and schema-level validation.
- Add unique indexes for normalized user email, lead email, and role name; add query-supporting indexes for lead status and creation date.
- Ensure model definitions are safe to import across repeated Next.js module evaluation.
- Add a consistent database error strategy for duplicate keys, invalid IDs, and missing records.

**Verify:** Model tests or integration tests confirm indexes, defaults, validation, uniqueness, and reference behavior against a test MongoDB instance.

### 4. Seed protected initial data

- Implement an idempotent seed script that connects to MongoDB, creates or verifies the system Super Admin role, and creates the initial Super Admin user from `SUPER_ADMIN_PASSWORD`. Migrate any legacy seeded Client role into a normal configurable client-type role without resetting its permissions.
- Hash the initial password with bcryptjs using a cost factor of at least 12; never log or store the plaintext password.
- Ensure rerunning the seed does not duplicate records or silently demote/unprotect the Super Admin.
- Document how to run the seed and how operators should supply and rotate the initial password.

**Verify:** A fresh database can be seeded; rerunning the script is safe; missing configuration fails with a clear error; the password is stored only as a hash.

### 5. Build shared database operations

- Add typed data-access helpers for users, roles, and leads, including populated user-role lookup for authorization.
- Implement lead listing with server-side pagination, search, and status filtering; use indexed fields and stable sorting.
- Implement role deletion checks for system roles and assigned users, and user operations that preserve Super Admin invariants.
- Normalize emails consistently before lookup and persistence. Handle unique-index conflicts as explicit client-safe errors.
- Keep database mutations narrow and enforce invariants in these operations as well as at the route boundary where appropriate.

**Verify:** Integration tests cover CRUD behavior, pagination/filtering, duplicate values, invalid IDs, assigned-role deletion, and protected Super Admin mutations.

### 6. Implement authentication and session handling

- Configure Auth.js v5 Credentials sign-in with normalized email lookup, bcrypt comparison, and inactive-account rejection.
- Configure JWT sessions and populate the session with the minimum identity and permission data required by the UI.
- Set an eight-hour session lifetime in line with the PRD; clarify and implement inactivity semantics rather than treating a fixed eight-hour maximum as sliding inactivity expiration.
- Add the Auth.js route handler and login/logout UI with accessible validation and generic invalid-credential errors.
- Ensure disabled or deleted accounts cannot continue to use protected APIs: handlers must re-fetch the current account and active state from MongoDB.

**Verify:** Tests cover successful/failed login, inactive users, logout, session expiry configuration, and session field typing.

### 7. Add authentication redirects and server-side authorization

- Add the Next.js `proxy.ts` request guard (the Next.js 16 successor to `middleware.ts`) for public login/Auth.js paths and unauthenticated page redirects. Keep the matcher narrow enough to exclude framework assets and public static files; allow API requests through so route guards return JSON 401/403 responses.
- Add a reusable server-side API guard that authenticates the session, fetches the current user and role, checks account activity, and enforces the requested permission; return 401 for unauthenticated/invalid accounts and 403 for insufficient permission.
- Add a server-side page/layout guard for protected dashboard routes and page-level permissions.
- Make Super Admin bypass explicit in the shared authorization logic. Never accept permission claims from request data or rely only on JWT-cached permissions for API decisions.
- Review every API route against a route/permission matrix so no data endpoint is accidentally left unguarded.

**Verify:** Automated tests exercise anonymous, inactive, unauthorized, authorized, and Super Admin requests for each resource; protected pages redirect or deny access appropriately.

### 8. Implement lead APIs and lead-management UI

- Implement `GET/POST /api/leads`, `GET/PUT/DELETE /api/leads/:id`, and `GET /api/leads/export`, each with the required permission and input validation.
- Set `createdBy` from the authenticated database user. Support optional `assignedTo` only when it references a valid user.
- Build the dashboard shell and lead list/detail/create/edit pages, including pagination, search, status filtering, status badges, and confirmation before deletion.
- Build accessible forms for all required lead fields and the sq ft/sq m toggle; convert values consistently and persist roof size in sq ft.
- Implement CSV export with appropriate content headers and safe CSV escaping; protect it with `leads:export`.
- Use server components for initial data loading where appropriate and client components for interactive controls.

**Verify:** API and UI tests cover CRUD permissions, filters/pagination, form validation, assignment, unit conversion, delete confirmation, and export output.

### 9. Implement role management and permission-aware UI

- Implement `GET/POST /api/roles` and `GET/PUT/DELETE /api/roles/:id` with their matching permissions and Zod schemas.
- Build role list/create/edit screens and a permissions checkbox grid driven by the shared permission list. Role creation includes an internal/client type selector. Only the Super Admin can create roles or grant/revoke permissions; client-type roles are managed like other custom roles.
- Prevent editing or deleting the system Super Admin role and prevent deleting any role still assigned to users.
- Add `AppGuardProvider`, `useAppGuard`, and `PermissionGate` for conditional navigation and action visibility. Populate permissions from trusted session data and handle session loading.
- Keep API and server page authorization authoritative even when the client hides a control.

**Verify:** Tests cover each role permission, role type validation, system-role protection, assigned-role deletion, and UI visibility for users with different permissions.

### 10. Implement user management

- Implement `GET/POST /api/users` and `GET/PUT/DELETE /api/users/:id` with their matching permissions and validation.
- Build user list/create/edit screens for name, normalized email, role, active state, and password creation/reset as required by the chosen account workflow.
- Hash passwords on the server and never return hashes from API responses.
- Prevent deleting, deactivating, or changing the role/Super Admin status of the seeded Super Admin. Do not expose a writable `isSuperAdmin` field in user forms or APIs.
- Confirm role assignment references an existing role and handle duplicate emails explicitly.

**Verify:** Tests cover create/update/deactivate/reactivate/delete permissions, password hashing, safe response fields, duplicate emails, and all Super Admin protections.

### 11. Complete navigation, accessibility, and responsive polish

- Add permission-aware navigation for dashboard, leads, roles, and users, while preserving server-side authorization on each destination.
- Use shadcn/ui primitives consistently for tables, dialogs, forms, feedback, and loading/empty/error states.
- Ensure keyboard access, labels, focus handling, contrast, semantic structure, and responsive layouts down to 375px.
- Add useful success/error feedback without exposing database internals or credentials.

**Verify:** Run accessibility checks and manually test primary workflows at desktop and mobile widths, including keyboard-only interaction.

### 12. Security, end-to-end testing, and performance verification

- Audit all route handlers against the permission matrix and verify Zod validation occurs before database writes.
- Verify cookies use secure production settings, `HttpOnly`, and an appropriate `SameSite` policy through Auth.js configuration.
- Check that secrets are absent from source, client bundles, logs, and API responses; verify production configuration rejects missing secrets.
- Add end-to-end workflows for login/logout, lead CRUD/export, role permissions, and user administration with both privileged and restricted users.
- Measure lead-list performance with representative data approaching 10,000 records; tune pagination, projections, and indexes as needed.

**Verify:** Lint, type-check, unit/integration/E2E tests, and production build pass; security checklist S-01 through S-12 and non-functional requirements are reviewed.

### 13. Deployment and operations readiness

- Document required environment variables, MongoDB provisioning, seed execution, build/start commands, and initial Super Admin setup.
- Configure production database access, TLS, backups, secret management, and least-privilege credentials.
- Deploy to a staging environment and verify auth callbacks, redirects, secure cookies, database connectivity, and seed behavior using non-production credentials.
- Run smoke tests for the principal workflows, then promote to production and define a rollback procedure.

**Verify:** Staging smoke tests pass and no default credentials or local-only configuration are present in production.

## Suggested delivery milestones

| Milestone | Steps | Outcome |
|---|---:|---|
| Foundation | 1–5 | Scaffold, domain contracts, database models, seed, and data-access layer |
| Secure access | 6–7 | Login/logout, protected routes, and verified server-side RBAC |
| Lead workflows | 8 | Lead list/detail/forms, CRUD, filtering, assignment, and CSV export |
| Administration | 9–10 | Role/permission management and user management |
| Release readiness | 11–13 | Accessible responsive UI, comprehensive verification, and deployment |

## Requirement traceability checklist

- [ ] F-01–F-05: Authentication, inactive account rejection, session lifetime, and logout
- [ ] F-10–F-16: Lead list/detail/CRUD, CSV export, assignment to internal users only, and roof-size units
- [ ] Lead pricing: $50 USD default base price, auditable additive top-ups for internal editors, computed final price, and permanent top-up lock on close
- [ ] Lead validation: required name, phone, address/state, roof-size, voice recording, and assignee fields; optional email; E.164 phone number; editable base price while open; and locked price once closed
- [ ] F-20–F-23: Role list/CRUD, permission assignment, and deletion safeguards
- [ ] F-30–F-34: User list/CRUD, role assignment, activation, and Super Admin safeguards
- [ ] Client accounts: Create client-type roles with selected permissions, and manage client accounts separately from internal users
- [ ] S-01–S-12: Route guards, server checks, password/session security, validation, and secret configuration
- [ ] Performance, accessibility, browser support, and 375px responsive layout