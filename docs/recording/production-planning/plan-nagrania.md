# Plan nagrania — planowanie produkcji (Open Mercato, odcinek po BOM)

Demo: `http://localhost:3018`, login `superadmin@acme.com` / `secret`, menu boczne → grupa **Produkcja**
(te same wyroby i materiały co w odcinku BOM — ta sama fikcyjna pracownia mebli ogrodowych).
Rozdzielczość nagrania 1440×900. Zrzuty referencyjne leżą obok tego pliku (numery w nawiasach).

## Przed nagraniem (5 minut)

1. Postgres `production-planning-postgres` (port 5473) ma działać: `docker start production-planning-postgres`.
2. Serwer: z katalogu repo `NODE_OPTIONS=--max-old-space-size=4096 yarn dev` → czekaj na `http://localhost:3018`.
3. **Reset w dniu nagrania (albo w sobotę — wychodzi to samo):** `node docs/recording/production-planning/reset-demo.cjs`.
   Terminy liczą się w dniach roboczych od dziś, więc w sobotę i w niedzielę plan zaczyna się od **pon. 30.11**.
   Skrypt kończy się linią `przeciążone dni gniazd: 0` — inna liczba = nie nagrywaj, napisz.
4. Zaloguj się, **zaakceptuj baner cookies** (inaczej zasłania oś czasu), przełącz język na polski, jeśli trzeba.
5. Otwórz raz każdą stronę z listy niżej (pierwsze wejście kompiluje stronę — kilka sekund ładowania nie powinno wejść w kadr).
6. Po każdej próbie — reset ponownie (usuwa pilne zlecenie, przywraca terminy).

Daty poniżej zakładają nagranie w weekend 28–29.11 (pierwszy dzień planu: pon. 30.11).

## Sceny

| # | Scena | Co klikam | Co mówię (kierunek) | Zrzut | Czego nie pokazywać |
|---|---|---|---|---|---|
| 1 | Gniazda | Produkcja → **Gniazda produkcyjne** | Warsztat to miejsca z pojemnością: krojownia 2 osoby, szwalnia 4, pakowanie półtora etatu. Pojemność w minutach na dzień — bo plan dodaje minuty. | 12 | Nie edytuj pojemności (zmienia liczby całego scenariusza). |
| 2 | Marszruta | Produkcja → **Marszruty** → *Poduszka na krzesło ogrodowe 45×45* | Każdy wyrób z BOM ma ścieżkę: krojownia → szwalnia → tapicernia → pakowanie, minuty na sztukę. Suma zgadza się z czasem robocizny z odcinka o BOM (18 min). | 13, 14 | Nie klikaj „Zapisz marszrutę” po zmianach. |
| 3 | Zlecenia | Produkcja → **Zlecenia produkcyjne** | Zlecenie = wyrób × ilość × termin. Planowany start liczy się sam — wstecz od terminu. | 10 | Kolumny „Robocizna” i „Dla kogo” są schowane celowo (lista się mieści). |
| 4 | Plan | Produkcja → **Plan produkcji** | Na górze obłożenie gniazd dzień po dniu, zielone / żółte / czerwone. Pod spodem każde zlecenie jako klocki etapów, chorągiewka = termin. Najedź na zlecenie — podświetlają się komórki, które ono zajmuje. | 01, 02, 03 | — |
| 5 | **WOW 1: klient chce wcześniej** | Przy **ZP/2026/013** (100 szt. poduszki 45×45, termin śr. 09.12) kliknij **◀** trzy razy (→ pt. 04.12) | Klient dzwoni: „dacie radę w piątek?”. Klikam… i widać: krojownia 122%, szwalnia 124% — czerwone. Kafelek „Przeciążone dni gniazd: 2”. Nie zgaduję, widzę. Potem **▶** trzy razy — wraca zielone. | 04, 05 | Nie przesuwaj innego zlecenia — scenariusz jest policzony na to jedno. |
| 6 | **WOW 2: pilne zlecenie** | **Pilne zlecenie** → wyrób *PO-45 — Poduszka 45×45*, ilość `80`, termin zostaw domyślny (**pon. 07.12**), tkanina *outdoor szara*, odniesienie dowolne → **Dodaj do planu** | Pilne z targów. Dodaję — tapicernia w piątek 113%, czerwona. Komunikat: przeciążone dni 0 → 1. To jest moment, w którym normalnie dzwoni się po wszystkich. | 06, 07 | Nie zmieniaj terminu w okienku (domyślny jest częścią scenariusza). |
| 7 | Decyzja planisty | Przy **ZP/2026/010** (*Wkład do poduszki 50×50 — na magazyn*) kliknij **▶** trzy razy | Co może poczekać? Wkłady na magazyn. Przesuwam je o trzy dni — tapicernia wraca do zieleni, plan bez czerwieni. System nie decyduje za mnie — pokazuje skutek każdej decyzji od razu. | 08 | — |
| 8 | Materiał | Przewiń do **Zapotrzebowanie materiałowe**; opcjonalnie klik w numer zlecenia → etapy i materiał na to zlecenie | Z BOM-u każdego zlecenia: ile wydać z magazynu (z naddatkiem), na kiedy. Pilne zlecenie już tu jest — dodało szarą tkaninę i gąbki. | 09, 11 | Pole „Termin” w formularzu zlecenia pokazuje datę po angielsku — nie zatrzymuj na nim kadru. |

## Liczby do sprawdzenia na ekranie (plan od pon. 30.11)

- Start: przeciążone dni gniazd **0**, najbardziej obciążone: Tapicernia **88%** (pt. 04.12).
- Scena 5 po trzech kliknięciach: Krojownia **122%** (wt. 01.12), Szwalnia **124%** (śr. 02.12), kafelek **2**.
- Scena 6: pilne dostaje numer **ZP/2026/017**, Tapicernia **113%** (pt. 04.12), kafelek **1**.
- Scena 7: kafelek **0**, Tapicernia w śr. 09.12 **92%** (żółte — tam pojechały wkłady).

Liczby pilnuje test `packages/production-planning/src/modules/production_planning/__tests__/recording-scenario.test.ts`
(zmiana danych demo, która zabiera czerwień, wywali test).

## Bezpieczeństwo ekranu

- Wszystkie nazwy, ilości i odniesienia są zmyślone (sklep internetowy, hotel, pensjonat, restauracja — bez nazw).
- Przełącznik organizacji pokazuje „Acme Corp” — dane przykładowe Open Mercato.
- Nie mów „oficjalny moduł Open Mercato” — to moduł społeczności na forku.
- Zrzuty w tym katalogu zrobiono w środę 25.11, więc mają daty od 25.11 — na nagraniu będą od 30.11, procenty te same.
