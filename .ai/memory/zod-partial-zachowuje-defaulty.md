---
name: zod-partial-zachowuje-defaulty
description: zod stosuje .default() także w .partial() — schemat update z create z defaultami zeruje pominięte pola
metadata:
  type: project
---

`z.object({ a: z.number().default(0) }).partial().parse({})` zwraca `{ a: 0 }`. Schemat aktualizacji zrobiony jako `createSchema.partial()` zamienia „zmień jedno pole” w „zresetuj wszystkie pola z defaultem”. Typecheck i testy wyceny tego nie widzą.

**Why:** w module ofert przycisk „Pobierz koszt z BOM” (PUT `{id, bomMaterialCost}`) wyzerował marżę i zużycie tkaniny; wyszło dopiero na przebiegu w przeglądarce (25.11.2026). Moduł BOM ma ten sam wzorzec (`updateProductSchema`, `updateMaterialSchema`) — masowe Aktywuj/Dezaktywuj resetuje czas robocizny i zużycie tkaniny.

**How to apply:** schemat update buduj z obiektu pól BEZ defaultów (`z.object(fields).partial()`), defaulty tylko w create; dołóż test, że parse częściowego payloadu zwraca wyłącznie wysłane klucze. ADR: `ai/decisions/2026-11-25-oferty-zlozone-wersje-i-wycena-z-regul.md`. Zob. [[db-generate-pakiet-standalone]].
