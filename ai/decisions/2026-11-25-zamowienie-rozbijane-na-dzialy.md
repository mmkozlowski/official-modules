# Zamówienie rozbijane na działy (moduł demo `department-routing`)

**Data:** 2026-11-25
**Status:** ✅ wdrożone (gałąź `feat/department-routing`, fork, bez PR do upstreamu)

## Problem
Do serii YouTube „Open Mercato dla produkcji” potrzebny był moduł, który pokaże produkcję na zamówienie
w kilku działach: zamówienie po przyjęciu samo rozbija się na zadania działów według konfiguracji produktu.
Działy odhaczają wykonaną ilość (także częściowo), a status zamówienia przelicza się sam. Na nagraniu ma to działać
bez zająknięcia w dwóch oknach naraz.

## Decyzja
- **Routing jako uporządkowana lista `department_ids` (jsonb) na produkcie**, a nie osobna tabela łącząca.
  Kolejność ma znaczenie, a zapis i odczyt idą jedną operacją. Raportu „które produkty używają działu X” nie ma
  w zakresie.
- **Własna encja produktu (`RoutedProduct`)**, bez powiązania z produktami BOM. Nazwy są te same co w demo BOM
  (ciągłość serii), ale moduł nie zależy od `production_bom` — prostszy seed, reset i brak zależności między modułami.
- **Zadanie = pozycja zamówienia × dział**, z kopią numeru zamówienia, klienta, produktu i terminu, więc tablica
  działu czyta jedną tabelę. Wzorzec podpatrzony we wdrożeniu produkcyjnym MTO, kod pisany od zera.
- **Status wyliczany, nie klikany:** `new` → `in_progress` (N/M działów) → `ready_to_ship`. Korekta w dół cofa
  status. Liczniki `departments_done/total` są trzymane na zamówieniu, żeby lista mogła filtrować i sortować.
- **Ilości częściowe pierwszej klasy** (`add` / `set`, historia w `task_reports`). Przekroczenie wymaganej ilości
  jest odrzucane (422), a nie przycinane.
- **Działy równolegle, bez blokowania.** Kolejność z routingu tylko sortuje ekran. Blokowanie kolejnych etapów
  (seria/równolegle) to osobna, większa decyzja i nie zmieściło się w terminie nagrania.
- **Odświeżanie na żywo = zdarzenia `clientBroadcast` + odpytywanie co 2–5 s, gdy karta jest widoczna.** Same zdarzenia
  wystarczyłyby przy działającym strumieniu SSE. Odpytywanie gwarantuje moment wow także wtedy, gdy strumień
  się nie połączy.
- **Reset demo przez komendę CLI modułu** (`yarn mercato department_routing reset-demo`), a nie przez endpoint HTTP.
  Moduł nie wystawia niszczącego API, a reset nie wymaga działającego serwera.

## Pułapki
- **Wyścig dwóch działów (zabezpieczony od początku, nie zaobserwowany):** bez blokady dwa raporty w tej samej
  sekundzie mogłyby policzyć „1/4” zamiast „2/4”, bo każdy czytałby zadania przed commitem drugiego. Dlatego
  `SELECT … FOR UPDATE` na wierszu zamówienia idzie **przed** odczytem zadania — i przy przyjęciu, i przy raporcie.
- **Natywny `<dialog>` w `ConfirmDialog`:** w Playwright `getByRole('dialog')` go nie znajduje, działa `locator('dialog[open]')`.
- **Pamięć maszyny:** `next dev` sandboxa zajmuje 9–12 GB. Serwer uruchamiaj z `NODE_OPTIONS=--max-old-space-size=4096`,
  zrzuty rób jednym przebiegiem, a serwer gaś zaraz po nich.

Powiązane: moduł BOM (`packages/production-bom`, ta sama seria).
