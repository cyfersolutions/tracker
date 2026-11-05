# Internal Lead CMS

Internal lead management built with Next.js App Router, Auth.js credentials authentication, MongoDB/Mongoose, TypeScript, and Tailwind CSS.

## Requirements

- Node.js 20.9 or newer
- MongoDB connection string
- An initial Super Admin password of at least 12 characters

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `AUTH_SECRET`, and `SUPER_ADMIN_PASSWORD`.
3. Generate a secret with `openssl rand -base64 32`.
4. Seed the protected Super Admin account:

   ```sh
   npm run seed
   ```

   Initial login: `superadmin@cms.internal`; use the password supplied in `SUPER_ADMIN_PASSWORD`.
5. Start the development server with `npm run dev`.

The seed command creates the `Super Admin` system role and account if absent. It does not reset an existing account's password.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run the development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler |
| `npm run build` | Create the production build |
| `npm run seed` | Create or verify the initial Super Admin |
| `npm run migrate:lead-prices` | Persist base price plus existing top-ups for all leads |

## Authorization

Middleware redirects unauthenticated page requests to `/login`. Each protected server page and API handler also revalidates the account and its current role against MongoDB. Client permission gates only control presentation and do not replace server authorization.

## Roles and accounts

Roles are configured for internal team access. The role editor does not expose the client-only `leads:topup` permission.

Client creation always assigns the protected **Client** role. The client form does not expose a role selector; Client accounts have lead viewing and price top-up access.

An account appears under **Clients** or **Users** according to its assigned role type. Editing a role's type moves all accounts assigned to that role between those tabs; the role editor warns and asks for confirmation before saving this change.

## Lead pricing

New leads start with a $50 USD base price. Only Super Admins and Client accounts can add described USD top-ups; each price-history entry is attributed and timestamped. The accumulated final price (base price plus all price-history entries and top-ups) is persisted in `finalPrice`. Only Super Admins and Client accounts can see price amounts and price history in lead lists, details, and exports. Setting the lead status to `CLOSED` permanently disables further top-ups, price changes, and reopening.

Super Admins can update the default lead price from **Settings**. The value is persisted in the `Settings` collection and updates all open leads by replacing their base price while preserving existing top-ups. Closed leads remain unchanged.

## Campaigns

Super Admins manage campaigns from **Campaigns**. A lead may belong to one campaign or **None**. Client accounts can be assigned multiple campaigns; clients only see leads belonging to their assigned campaigns.

Lead name, email, E.164 phone number (for example `+14155552671`), street, city, country, postal code, and roof size are required. Video uploads are optional and have no server-side type or extension checks; uploads are limited to 250 MB. Multer stores uploads outside the public directory in `uploads/lead-videos` by default; set `LEAD_VIDEO_STORAGE_DIR` to a persistent server directory when deploying. Uploaded files are served through an authenticated endpoint. When editing a lead, leave the file picker empty to keep its current video.

## Deployment notes

- Configure `MONGODB_URI`, `AUTH_SECRET`, and `SUPER_ADMIN_PASSWORD` in the deployment secret manager; never use the example values in production.
- Run the seed command once against the intended database before enabling user sign-in.
- Use a TLS-protected MongoDB connection with least-privilege credentials and regular backups.
- Auth.js JWT sessions have an eight-hour rolling maximum age.
