# Plan nagrania — zamówienie rozbijane na działy (Open Mercato dla produkcji)

Demo: `http://localhost:3020`, login `superadmin@acme.com` / `secret`, menu boczne → grupa **Produkcja**
(ta sama grupa co BOM: Zamówienia produkcyjne, Tablica działu, Działy, Routing produktów).
Firma jest ta sama co w odcinku o BOM: mały warsztat mebli ogrodowych. Wszystkie dane są zmyślone.
Nagrywaj w rozdzielczości 1440×900, z polskim interfejsem. Zrzuty referencyjne leżą obok tego pliku,
a ich numery są podane w nawiasach.

**Przed nagraniem i po każdej próbie:** `node docs/recording/department-routing/reset-demo.cjs`. Skrypt
przywraca zamówienie **ZAM/2026/0141** jako „Nowe” i liczy terminy od dzisiaj. Nie potrzebuje działającego
serwera.

**Układ okien na moment wow (sceny 6–7):** przed sceną 6 otwórz z karty działu („Otwórz tablicę działu”)
dwie tablice w osobnych oknach: **Stolarnia** (lewa połowa ekranu) i **Tapicernia** (prawa połowa).
Okno z zamówieniem zostaw pod spodem albo na drugim monitorze. Przy połowie szerokości kolumny tablicy
układają się jedna pod drugą — karty „Do zrobienia” są na górze, więc to nie przeszkadza.

| # | Scena | Co klikam | Co widać | Co mówię (kierunek) | Czego nie pokazywać |
|---|---|---|---|---|---|
| 1 | Zamówienia w jednym miejscu | Produkcja → **Zamówienia produkcyjne** | Lista: nowe, w realizacji z paskiem „2/3”, „1/5”, gotowe do wysyłki; termin po terminie na czerwono (01) | „Każde zamówienie widać tu z jednym paskiem: ile działów już skończyło. Bez dzwonienia na halę.” | Kolumny „Produkty” nie włączaj — przy menu bocznym jest ucięta. |
| 2 | Kto co robi: działy i routing | **Działy** (02) → **Routing produktów** (03) → klik **Ławka ogrodowa z oparciem 150 cm** (04) | 5 działów z liczbą otwartych zadań; każdy produkt ma swoją ścieżkę, np. „Stolarnia → Lakiernia → Tapicernia → Pakowanie” | „Raz ustawiasz, przez które działy przechodzi produkt. Od tej chwili system wie, komu dać robotę.” | Nie odznaczaj działów w routingu ławki — zmiana zostaje do resetu i psuje scenę 4. |
| 3 | Nowe zamówienie od klienta | Zamówienia → **ZAM/2026/0141** (Pensjonat — Mazury) | 4× ławka, 2× stół; przy każdej pozycji, przez które działy przejdzie; pod spodem „Po przyjęciu zamówienie trafi do: Stolarnia, Lakiernia, Tapicernia, Pakowanie” (05) | „Zanim cokolwiek przyjmę, widzę, do których działów to trafi.” | — |
| 4 | Przyjęcie → rozbicie na działy | **Przyjmij do realizacji** → w oknie **Potwierdź** | Okno z listą działów (06); po potwierdzeniu komunikat „Przyjęte — rozbite na 5 zadań w 4 działach”, cztery karty działów po 0 szt., status „W realizacji 0/4 działy” (07) | „Jedno kliknięcie i zamówienie samo rozpada się na zadania. Nikt nie przepisuje go na kartki dla działów.” | Nie klikaj dwa razy — drugie kliknięcie nic nie zepsuje, ale na nagraniu wygląda na zawahanie. |
| 5 | Tablica działu, odhaczanie części | Na karcie **Stolarnia** → **Otwórz tablicę działu** | Kanban: Do zrobienia / W toku / Zrobione (08). Na ławce **+1**, potem wpisz `3` i **Odhacz** — karta przechodzi do „W toku” z 1/4, potem 4/4 (09) | „Dział odhacza tyle, ile zrobił — także część. Wpisuje liczbę albo klika plus jeden.” | Nie wpisuj więcej, niż zostało — pojawi się komunikat „To więcej, niż potrzeba” (działa, ale rozprasza). |
| 6 | **MOMENT WOW** — dwa działy naraz | Dwa okna obok siebie (Stolarnia / Tapicernia). Stolarnia: **Całość (2)** na stole. Tapicernia: **Całość (4)** na ławce. Przełącz na okno zamówienia | Obie karty lądują w „Zrobione”; zamówienie bez przeładowania pokazuje „W realizacji 2/4 działy”, karty Stolarni i Tapicerni zielone z „Zakończony”, karta działu, który się zmienił, mignie żółtą ramką (10, 11) | „Dwa działy, dwa okna, nikt nikomu nic nie mówi — a zamówienie samo wie, że połowa jest gotowa.” | Nie odświeżaj okna zamówienia (F5) — cały efekt polega na tym, że odświeża się samo (najpóźniej po 2 s). |
| 7 | Gotowe do wysyłki | Na tablicy: **Lakiernia** → **Całość** na obu kartach; **Pakowanie** → **Całość** na obu kartach. Wróć do zamówienia | Komunikat „Zamówienie ZAM/2026/0141 jest gotowe do wysyłki” (12); na zamówieniu zielony pasek „Gotowe do wysyłki — wszystkie działy skończyły pracę”, 4 z 4 (13) | „Ostatnie odhaczenie w pakowaniu — i zamówienie samo przechodzi na gotowe do wysyłki. Biuro widzi to w tej samej sekundzie.” | — |
| 8 | Lista na koniec | Zamówienia produkcyjne | 0141 z zielonym „Gotowe do wysyłki” i paskiem 4/4 (14) | „Rano otwierasz jedną listę i wiesz, co dziś wyjeżdża.” | — |

## Liczby do sprawdzenia na ekranie

- ZAM/2026/0141: 4× Ławka ogrodowa z oparciem 150 cm + 2× Stół ogrodowy 120×80 → **5 zadań w 4 działach**.
- Po przyjęciu: Stolarnia 0/6 szt., Lakiernia 0/6, Tapicernia 0/4, Pakowanie 0/6.
- Po scenie 6: „W realizacji 2/4 działy”, „Zakończone działy: 2 z 4”.
- Termin 0141: dziś + 8 dni (ustawiany przy resecie).

## Czego nie pokazywać / bezpieczeństwo ekranu

- Klienci są opisani rodzajem i miastem („Pensjonat — Mazury”), bez nazw firm i osób. Cen w module nie ma.
- Przełącznik organizacji pokazuje „Acme Corp” — to przykładowe dane Open Mercato.
- Nie mów „oficjalny moduł Open Mercato”. To moduł demo zbudowany na Open Mercato.
- Nie klikaj **Usuń** na zamówieniu (po resecie wraca, ale na nagraniu to zbędny wątek).

## Zrzuty od nowa

Zrzuty robi `capture-scenes.cjs` jednym przebiegiem. Przechodzi cały scenariusz razem z momentem wow, więc
jest też próbą generalną. Kolejność: reset → serwer (`NODE_OPTIONS=--max-old-space-size=4096 yarn dev`) →
`node docs/recording/department-routing/capture-scenes.cjs` → wyłącz serwer → reset.
