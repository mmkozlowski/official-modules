---
name: demo-moduly-produkcji-porty
description: Każde demo modułu produkcji ma własny Postgres i port aplikacji; reset danych demo idzie przez CLI modułu
metadata:
  type: project
---

Demo serii „Open Mercato dla produkcji” (nagranie 29.11.2026) działają równolegle w osobnych worktree:
BOM — Postgres 5472 / app 3017; zamówienie rozbijane na działy (`department-routing`) — Postgres 5475
(kontener `department-routing-postgres`) / app 3020. Porty siedzą tylko w `apps/sandbox/.env` danego worktree (gitignored).

**Why:** trzy sesje demo naraz nie mogą dzielić bazy ani portu.
**How to apply:** przed startem sprawdź `.env` (`DATABASE_URL`, `APP_URL`, `PORT`). Reset danych działów:
`node docs/recording/department-routing/reset-demo.cjs` (bez serwera). Zobacz też [[dev-server-limit-pamieci]].
