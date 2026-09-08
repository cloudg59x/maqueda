# Admin UI

Back to [maqueda-core README](../README.md) · [architecture](architecture.md)

Dark-only shadcn/ui ("zinc") theme. Tokens live in `src/app/globals.css` (Tailwind v4, `@theme inline`).
Root layout fixes the `dark` class; there is no theme toggle.

## Layout

`src/app/admin/layout.tsx` is the only place that renders `SidebarProvider`, `AppSidebar`, `SidebarInset`
and `SiteHeader`. Pages render content only. The layout also loads the current user, unread alert count
and the last 5 alerts for the header bell.

- `components/app-sidebar.tsx`: nav (Dashboard, Clients, Alerts, Users, Settings), logo, chain label, user menu with logout.
- `components/site-header.tsx`: sidebar trigger, breadcrumb derived from the pathname, `AlertBell` popover.
- `components/brand/logo.tsx`: inline SVG mark, `currentColor`.

## Pages

| Route | Server data | Client components |
|---|---|---|
| `/admin` | `getDashboardStats`, `getRecentAlerts(10)` | `AutoRefresh` 15 s |
| `/admin/clients` | `getClientsWithBalances` | `ClientsTable` (TanStack: search, status filter, sort, row click), `ClientActionsMenu` |
| `/admin/clients/[id]` | `getClientDetail`, `getClientBalanceHistory`, `getAlerts({clientId})`, `getClientAuditLog` | tabs: balances chart (recharts step area), alerts, audit, device/geo; activate/deactivate/delete with `AlertDialog` |
| `/admin/alerts` | `getAlerts({type, unreadOnly})` from `searchParams` | `AlertsTable`: mark one / all read |
| `/admin/settings` | `loadSettings`, `getMonitoredTokens` (ADMIN only) | `SettingsForm` (react-hook-form + zod, Telegram test button), `TokensTable` (enable switch, edit contract address) |
| `/admin/users` | `getUsers` (ADMIN only) | `CreateUserDialog`, `DeleteUserButton` |

`AutoRefresh` calls `router.refresh()` on an interval while the tab is visible; list pages use 30 s.

## Patterns

- Mutations: client component → server action → `{ success, error? }` → `toast` → `router.refresh()`.
  Destructive actions always go through `AlertDialog`.
- Status: `clientStatus()` maps `{isActive, belowThreshold}` to `seen | below | inactive`; `ClientStatusBadge` renders it,
  labels and descriptions live in `CLIENT_STATUS_INFO`. Ladder: **Seen** (connect popup only, nothing enforceable) →
  **Enrolled** (future: on-chain allowance to the contract) → **Deactivated**. Never label a merely-connected wallet as
  active or connected; see [plans/2026-09-08-enforcement-model.md](plans/2026-09-08-enforcement-model.md).
  `AlertTypeBadge` does the same for alert types. Add colours there, not inline.
- Numbers: `formatTokenAmount`, `formatUsd`, `shortAddress` from `lib/tokens.ts`; dates via `lib/format.ts`.
- Forms: `react-hook-form` + `zodResolver`. Numeric inputs use `z.coerce.number()` with `z.input`/`z.output` generics on `useForm`.
- Relative times in **client** components go through `components/time-ago.tsx` (`suppressHydrationWarning` + 30 s refresh);
  server components can call `timeAgo()` directly.
- Adding a shadcn component: `npx shadcn@latest add <name>`; the CLI writes to `src/components/ui`.
  `components.json` is in Tailwind v4 mode (`tailwind.config: ""`), so generated files use `w-(--var)` syntax and the
  unified `radix-ui` package. Do not paste Tailwind v3-era shadcn code (`w-[--var]`, `theme(spacing.4)`, `hsl(var(...))`):
  it silently produces no CSS under v4.
