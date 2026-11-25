---
name: demo-planowania-scenariusz
description: Dane demo modułu production-planning są nastrojone pod moment wow nagrania — każda zmiana musi przejść test recording-scenario
metadata:
  type: project
---

`packages/production-planning/src/modules/production_planning/lib/demo-data.ts` (pojemności gniazd, marszruty, 16 zleceń,
sekcja `rehearsal`) jest strojone tak, że plan startuje bez czerwieni, przesunięcie ZP/…/013 o 3 dni wcześniej daje
Krojownia 122% / Szwalnia 124%, pilne PO-45 ×80 na +5 dni roboczych daje Tapicernia 113%, a przesunięcie wkładów
(ZP/…/010) o 3 dni później zdejmuje czerwień. Domyślny termin w oknie pilnego zlecenia (`URGENT_DEFAULT_LEAD_DAYS`) musi
równać się `rehearsal.urgent.dueInWorkingDays`.

**Why:** nagranie serii 29.11.2026 — liczby są w planie nagrania; niewidoczna zmiana danych zabiera „wow”.
**How to apply:** po każdej zmianie danych demo/planisty uruchom `yarn workspace @open-mercato/production-planning test`
i zaktualizuj liczby w `docs/recording/production-planning/plan-nagrania.md`. ADR: `ai/decisions/2026-11-25-production-planning-backward-schedule.md`.
Powiązane: [[pamiec-maca-dema]].
