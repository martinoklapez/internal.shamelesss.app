# Project Index: internal.shamelesss.app

Internal admin panel for Shamelesss (Next.js 14, TypeScript, Supabase, Radix UI). This index maps routes, API endpoints, components, and data layer.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Auth & DB | Supabase (SSR client, `user_roles` for RBAC) |
| UI | Radix UI, Tailwind CSS, Lucide icons, shadcn-style components |
| Other | ReactFlow, Replicate (image generation) |

---

## Authentication & authorization

- **Middleware** (`middleware.ts`): Supabase auth + role check; protects `/home`, `/games`, `/devices`, `/feature-flags`, `/characters`, `/generate` and sub-routes.
- **Roles** (`lib/user-roles.ts`): `admin`, `dev`, `developer`, `promoter`, `user`, `demo`. Allowed in app: `admin`, `dev`, `developer`, `promoter`. `demo` has same rights as `user` (no panel access; for internal identification only).
- **Promoter restrictions**: Promoters cannot access `/games` or `/feature-flags`; redirected to `/home`.
- **Sign-in**: `/` → redirect to `/home` when authenticated.

---

## App routes (pages)

| Path | Description | Role access |
|------|-------------|-------------|
| `/` | Sign-in | Public |
| `/home` | Home | All authenticated |
| `/knowledge` | Knowledge | All authenticated |
| `/feature-flags` | Feature flags | admin, dev, developer |
| `/games` | Games list | admin, dev, developer |
| `/games/[gameId]` | Game detail | admin, dev, developer |
| `/games/[gameId]/categories/[categoryId]` | Category | admin, dev, developer |
| `/games/[gameId]/content` | Game content (MLT, NHE, WYR, positions, roleplay) | admin, dev, developer |
| `/onboarding` | App onboarding | admin, dev, developer |
| `/users` | Users | admin, dev, developer |
| `/generate` | Image generation | admin, dev, developer |
| `/devices` | Devices | promoter, admin |
| `/devices/[deviceId]` | Device detail | promoter, admin |
| `/characters` | AI characters | All authenticated |
| `/characters/[characterId]` | Character detail (refs, generated images) | All authenticated |
| `/reports` | Reports | admin, dev, developer |
| `/support-tickets` | Support tickets | admin, dev, developer |
| `/refund-requests` | Refund requests | admin, dev, developer |
| `/profile` | Profile | (assumed authenticated) |
| `/accounts` | Accounts | (assumed authenticated) |
| `/test-tiktok` | TikTok test | (assumed dev) |

---

## API routes

### Categories
- `POST /api/categories/create`
- `DELETE /api/categories/delete`
- `PATCH /api/categories/toggle`
- `PATCH /api/categories/update`

### Characters
- `POST /api/characters/create`
- `DELETE /api/characters/delete`
- `GET /api/characters/list`
- `PATCH /api/characters/update`
- `POST /api/characters/[characterId]/reference-images/upload`
- `DELETE /api/characters/[characterId]/reference-images/delete`
- `PATCH /api/characters/[characterId]/reference-images/toggle-default`
- `POST /api/characters/[characterId]/generated-images/[imageId]/archive`

### Content (game content types)
- **Most Likely To**: `POST /api/content/most-likely-to/create`, `DELETE /api/content/most-likely-to/delete`
- **Never Have I Ever**: `POST /api/content/never-have-i-ever/create`, `DELETE /api/content/never-have-i-ever/delete`
- **Would You Rather**: `POST /api/content/would-you-rather/create`, `DELETE /api/content/would-you-rather/delete`
- **Positions**: `POST /api/content/positions/create`, `DELETE /api/content/positions/delete`, `POST /api/content/positions/upload`
- **Roleplay scenarios**: `POST /api/content/roleplay-scenarios/create`, `DELETE /api/content/roleplay-scenarios/delete`

### Devices & profiles
- `POST /api/devices/create`
- `POST /api/icloud-profiles/create`, `PATCH /api/icloud-profiles/update`, `POST /api/icloud-profiles/archive`
- `POST /api/proxies/create`, `PATCH /api/proxies/update`, `POST /api/proxies/archive`

### Feature flags & onboarding
- `PATCH /api/feature-flags/toggle`
- `GET /api/onboarding/components`
- `GET /api/onboarding/conversion-screens`
- `GET /api/onboarding/quiz-screens`

### Users & profile
- `POST /api/users/create`, `GET /api/users/list`, `PATCH /api/users/update`
- `PATCH /api/profile/update`
- `DELETE /api/connections/[id]/delete`
- `DELETE /api/friend-requests/[id]/delete`

### Social accounts
- `POST /api/social-accounts/create`, `PATCH /api/social-accounts/update`, `POST /api/social-accounts/archive`

### Generate
- `POST /api/generate` (image generation)
- `GET /api/generate/download`

### Support & moderation
- `GET /api/refund-requests`, `PATCH /api/refund-requests/[id]`
- `GET /api/reports`, `GET /api/reports/stats`, `PATCH /api/reports/[id]`
- `GET /api/support-tickets`, `PATCH /api/support-tickets/[id]`

### Test
- `GET /api/test/tiktok` (or similar)

---

## Components

### Layout & shell
- `app-sidebar.tsx` – Sidebar with role-based nav (general, developer, promoter, support/moderation).
- `sidebar-content.tsx` – Wraps sidebar, fetches user role.
- `breadcrumb-wrapper.tsx` – Breadcrumbs.
- `root-layout-wrapper.tsx` – Root layout wrapper.
- `sign-out-button.tsx` – Sign out.
- `version-switcher.tsx` – Version switcher.

### UI primitives (`components/ui/`)
- alert-dialog, avatar, badge, breadcrumb, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, sidebar, switch, textarea, toast, toaster, tooltip.

### Domain components
- **Users**: `users-manager.tsx`, `add-user-dialog.tsx`, `edit-user-dialog.tsx`, `search-form.tsx`.
- **Devices**: `devices-manager.tsx`, `device-details.tsx`, `add-device-dialog.tsx`, `add-icloud-profile-dialog.tsx`, `add-proxy-dialog.tsx`.
- **Games**: `game-card.tsx`, `category-manager.tsx`, `category-dialog.tsx`.
- **Content**: `most-likely-to-list.tsx`, `add-most-likely-to-dialog.tsx`; `never-have-i-ever-list.tsx`, `add-never-have-i-ever-dialog.tsx`; `would-you-rather-list.tsx`, `add-would-you-rather-dialog.tsx`; `positions-list.tsx`, `add-position-dialog.tsx`; `roleplay-scenarios-list.tsx`, `add-roleplay-scenario-dialog.tsx`.
- **Characters**: `characters-manager.tsx`, `character-dialog.tsx`, `reference-images-manager.tsx`, `reference-images-modal.tsx`, `generated-images-gallery.tsx`, `generate-image-form.tsx`.
- **Feature flags**: `feature-flags-manager.tsx`.
- **Onboarding**: `onboarding-manager.tsx`, `onboarding-screen-dialog.tsx`, `onboarding-screen-preview.tsx`, `onboarding-screen-renderer.tsx`.
- **Support/moderation**: `reports-manager.tsx`, `report-detail-dialog.tsx`, `reports-stats.tsx`; `support-tickets-manager.tsx`, `support-ticket-detail-dialog.tsx`; `refund-requests-manager.tsx`, `refund-request-detail-dialog.tsx`.
- **Profile**: `profile-editor.tsx`, `add-social-account-dialog.tsx`.

### Barrel
- `components/index.ts` – Re-exports all public components.

---

## Data layer

### Supabase
- `lib/supabase/client.ts` – Browser client.
- `lib/supabase/server.ts` – Server client.
- `lib/supabase/index.ts` – Barrel.

### Database modules (`lib/database/`)
Exported via `lib/database/index.ts`:
- `batch-id.ts`
- `categories.ts`
- `characters.ts`
- `devices.ts`
- `feature-flags.ts`
- `games.ts`
- `most-likely-to.ts`
- `never-have-i-ever.ts`
- `onboarding.ts`
- `onboarding-components.ts`
- `positions.ts`
- `roleplay-scenarios.ts`
- `would-you-rather.ts`

Present but **not** in barrel (used directly by API or pages):
- `refund-requests.ts`
- `reports.ts`
- `support-tickets.ts`

### Other lib
- `lib/user-roles.ts` – Role types and helpers.
- `lib/utils.ts` – General utils.
- `lib/utils/date.ts` – Date helpers.
- `lib/game-images.ts`, `lib/social-platform-images.ts` – Image helpers.
- `lib/instagram-scraper.ts`, `lib/tiktok-scraper.ts` – Scrapers.
- `lib/replicate/client.ts` – Replicate (image generation).
- `lib/index.ts` – Re-exports utils, user-roles, game-images, scrapers, database, supabase.

---

## Types

- `types/database.ts` – DB-related types.
- `types/onboarding.ts` – Onboarding types.
- `types/index.ts` – Barrel.

---

## Config & env

- **Env**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see README).
- **Config**: `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `.eslintrc.json`.

---

## Supabase & migrations

- **Migrations**: `supabase/migrations/` (e.g. `add_is_archived_to_generated_images.sql`, `add_storage_policies_for_positions.sql`, `create_ai_characters_tables.sql`).
- **Docs**: `AI_CHARACTERS_SETUP.md`, `supabase/STORAGE_SETUP.md`.
- **SQL**: `fix_insert_policies_*.sql`, `fix_rls_policies*.sql`, `get_all_rls_policies.sql`, `reset_all_rls_policies.sql`, `test_rls_policies.sql`.

---

## Quick reference: where to look

| Need | Location |
|------|----------|
| Add a page | `app/<segment>/page.tsx` |
| Add API route | `app/api/<segment>/route.ts` |
| Auth & route protection | `middleware.ts` |
| Role definitions | `lib/user-roles.ts` |
| Sidebar nav | `components/app-sidebar.tsx` |
| DB access for a table | `lib/database/<module>.ts` |
| Shared UI | `components/ui/` |
| Shared types | `types/` |
