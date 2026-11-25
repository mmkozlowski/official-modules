# Oferty złożone: wycena z reguł, migawka pozycji i blokada wysłanej wersji

**Data:** 2026-11-25
**Status:** ✅ wdrożone (moduł demo `@open-mercato/complex-offers`, gałąź `feat/complex-offers`)
**Powiązane:** moduł BOM (`packages/production-bom`), plan nagrania `docs/recording/complex-offers/plan-nagrania.md`

## Problem

Oferta na meble na wymiar to iloczyn parametrów (wymiar × tkanina × dodatki × ilość), a nie cena z cennika. Na nagraniu ma działać jedna rzecz na 100%: zmiana jednego parametru przelicza ofertę z rozbiciem „skąd ta cena”, a wersja już wysłana do klienta zostaje nietknięta.

## Decyzja

1. **Jedna czysta funkcja wyceny** (`lib/pricing.ts`) — używana przez serwer (źródło prawdy przy zapisie) i przeglądarkę (rozbicie). Kroki zaokrąglane do grosza przed sumowaniem, mnożenie po groszach (`1,8125 m × 4600 gr`), żeby rozbicie zawsze sumowało się do kwoty pod nim.
2. **Pozycja przechowuje migawkę** (rozbicie, etykiety, ceny). Wysłana wersja drukuje się tak samo po zmianie cennika czy BOM.
3. **Blokada na serwerze, nie w UI:** zapis pozycji / nagłówka wersji innej niż robocza → `409 version_locked`. Zmiana po wysłaniu = `copy` → nowa robocza wersja przeliczona aktualnym cennikiem. Jedna robocza naraz; status zmienia się tylko na wersji bieżącej.
4. **Bez wspólnych tabel z BOM:** model trzyma kod wyrobu BOM i migawkę kosztu; odświeżenie przez publiczne API BOM z przeglądarki.
5. **PDF = drukowalny HTML A4** z API (`/versions/{id}/print`), zapis przez „Zapisz jako PDF”. Brak biblioteki PDF w repo, zero ryzyka z polskimi znakami/fontami. Wydruk nie zawiera marży ani rozbicia.
6. **Nazwa grupy w menu „Oferty złożone”** — rdzeń OM ma już „Sprzedaż → Oferty”.

## Pułapki

- **zod: `.default()` działa wewnątrz `.partial()`.** `createSchema.partial()` jako schemat aktualizacji zeruje każde pominięte pole z defaultem. Wyszło dopiero w przeglądarce: „Pobierz koszt z BOM” (PUT `{id, bomMaterialCost}`) wyzerował marżę i zużycie tkaniny — testy jednostkowe i typecheck były zielone. Naprawione osobnym schematem pól bez defaultów + test `partial-update-keeps-fields`. **Ten sam wzorzec jest w module BOM** (`updateProductSchema`, `updateMaterialSchema`) — do naprawy osobną zmianą.
- **`mercato db generate` nie widzi encji pakietu w trybie standalone**, gdy istnieje `dist/` (szuka `entities.ts` w `dist/modules/.../data`). Obejście: tymczasowy pusty `dist/.../data/entities.ts`, wygenerowanie, skopiowanie migracji i snapshotu do `src/.../migrations`, `rm -rf dist` i ponowny build (inaczej w `dist` są dwie kopie migracji).
- `CrudForm` renderuje `extraActions` w nagłówku i w stopce — selektory w testach muszą brać `.first()`.
- `NODE_OPTIONS=--max-old-space-size` ogranicza stertę JS, nie RSS serwera dev (Turbopack) — przy pierwszej kompilacji RSS i tak dochodzi do ~9,5 GB.
