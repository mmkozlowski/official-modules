# Planowanie produkcji: harmonogram wstecz od terminu, nieskończona pojemność, plan liczony w przeglądarce

**Data:** 2026-11-25
**Status:** ✅ wdrożone (gałąź `feat/production-planning`, moduł `packages/production-planning`)
**Powiązane:** moduł BOM (`packages/production-bom/README.md`), plan nagrania `docs/recording/production-planning/plan-nagrania.md`

## Problem

Demo do odcinka „Open Mercato dla produkcji — planowanie”. Potrzebny jeden pewny moment wow: przesuwam termin albo
dokładam pilne zlecenie, a plan i obłożenie gniazd przeliczają się na oczach widza, przeciążone gniazdo robi się
czerwone. Zakres musi zmieścić się w trzech dniach i nie może się sypać na nagraniu.

## Decyzja

1. **Harmonogram wstecz od terminu, bez wyrównywania pojemności.** Ostatni krok marszruty kończy się w dniu terminu,
   wcześniejsze — w kolejnych dniach roboczych wstecz; krok trwa `ceil(minuty / pojemność)` dni. Zlecenia na tym samym
   gnieździe w tym samym dniu się sumują — przeciążenie jest **pokazane**, nie ukryte. To klasyczne CRP: system pokazuje
   konflikt, decyzja należy do planisty. Wyrównywanie (przesuwanie za planistę) to inny produkt i większe ryzyko.
2. **Operacje nie są zapisywane** — wynikają z marszruty przy każdym odczycie. Zmiana terminu albo marszruty działa
   od razu i nie ma drugiej kopii planu, która mogłaby się rozjechać.
3. **Plan liczony w przeglądarce** z tych samych czystych funkcji co na serwerze (`lib/schedule.ts`, `lib/plan-model.ts`).
   Strona trzyma *wejście* planu w stanie; ruch zlecenia = zmiana stanu → natychmiastowe przeliczenie; zapis idzie w tle
   (`POST …/reschedule`), przy odmowie stan wraca. To daje płynny moment wow bez czekania na serwer.
4. **Integracja z BOM, nie kopia.** Wyroby, linie BOM i materiały czytane z `production_bom`; zapotrzebowanie przez jego
   `computeRequirements` (BigInt, naddatek, tkanina wybierana w zleceniu).
5. **Dane demo z terminami względnymi** (dni robocze od dnia seeda/resetu) w jednym module `lib/demo-data.ts`, czytanym
   i przez seed, i przez skrypt resetu (z `dist`). Scenariusz nagrania strzeże test `recording-scenario.test.ts`.

## Pułapki

- `yarn mercato db generate` w trybie standalone **pomija pakiety** (szuka `entities.ts` w `dist`). Obejście jak w BOM:
  moduł tymczasowo jako `@app` przez symlink. Zapisane w README pakietu.
- Superadmin bez organizacji: zapisy CRUD wymagają cookie `om_selected_org` (skrypt resetu je ustawia).
- Numeracja zleceń liczy tylko żywe zlecenia — po resecie pilne zlecenie zawsze dostaje ten sam numer (ZP/…/017);
  koszt: numer usuniętego zlecenia może wrócić. Świadomy kompromis na czas demo.
- Natywne `<input type="date">` pokazuje format wg języka przeglądarki, nie strony — na osi czasu zastąpione
  sformatowaną datą ze strzałkami ◀ ▶.
- Brak kalendarza świąt i postępu per operacja — znane luki.
