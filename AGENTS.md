# Guide for AI coding agents

Read this first. It is short on purpose; follow the links for depth.

## Ground rules

1. **Never run `git commit`, `git push`, `gh pr`, or fork.** The owner commits. Pushes reach a public repo,
   so nothing leaves the machine without the owner's review. Restoring a file with `git checkout -- <path>` is fine.
2. **Everything in English**: code, comments, docs, commit messages the owner will write.
3. **Audit everything**: every admin action and worker event writes an `AuditLog` row via `lib/audit.ts`.
   New server action → new `AuditAction` constant → `audit()` call.
4. **Keep the READMEs linked.** New module → mention it in the closest README and link it from here or the root.
5. MVP mindset: it must work and be readable. Do not add queues, caches, or abstractions for scale we do not have.

## Where things live

| Need | Go to |
|---|---|
| Repo overview, quick start | [`README.md`](README.md) |
| Admin app setup, scripts, env vars | [`maqueda-core/README.md`](maqueda-core/README.md) |
| Data model, flows, decisions | [`maqueda-core/docs/architecture.md`](maqueda-core/docs/architecture.md) |
| Balance monitor loop, alert rules, debugging | [`maqueda-core/docs/worker.md`](maqueda-core/docs/worker.md) |
| Pages, components, UI patterns | [`maqueda-core/docs/admin-ui.md`](maqueda-core/docs/admin-ui.md) |
| The dApp and its API contract | [`maqueda-deploy/README.md`](maqueda-deploy/README.md) |
| Why things are the way they are | [`maqueda-core/docs/plans/`](maqueda-core/docs/plans/) (design + plan per iteration) |

## Conventions in `maqueda-core`

- Next.js 16 App Router. Server components fetch through `src/actions/*` (server actions); client
  components mutate through the same actions with `useTransition` + `sonner` toasts.
- Auth: `requireUser()` in pages (redirects), `requireAdmin()` in actions (throws). See `src/lib/auth.ts`.
- DB: always `import { prisma } from "@/lib/db"`. Never `new PrismaClient()` elsewhere.
- Money: raw balances are `bigint` / `Decimal(78,0)`; USD is `number` rounded to cents. Helpers in `src/lib/tokens.ts`.
- Chains: hex ids (`0x1`, `0xaa36a7`). `src/lib/chains.ts` is the only place that knows chain metadata.
- Tests: `vitest`, colocated in `__tests__/` next to the code. Pure logic (rules, prices, math) must be tested.
- UI: shadcn/ui components in `src/components/ui`, dark theme only, no theme toggle.
- The worker imports from `src/lib` and `src/worker` only, never from `src/app` or `src/components`.

## Verify before claiming done

```bash
cd maqueda-core
npm run typecheck && npm run lint && npm test && npm run build
```
