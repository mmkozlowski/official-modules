# Plan nagrania — Oferty złożone dla mebli na zamówienie (Open Mercato)

Demo: `http://localhost:3019`, login `superadmin@acme.com` / `secret`, menu boczne → grupa **Oferty złożone** (pozycje **Oferty** i **Modele i cenniki**).
Rozdzielczość nagrania 1440×900. Zrzuty referencyjne leżą obok tego pliku (numery w nawiasach).
Ta sama fikcyjna pracownia mebli ogrodowych co w odcinku o BOM: modele ofertowe biorą koszt materiałów z wyrobów BOM (PO-120, PO-45, ST-120), tkaniny mają ceny z BOM.

**Przed nagraniem i po każdej próbie:** `node docs/recording/complex-offers/reset-demo.cjs` (działa bez serwera; przywraca 3 modele i 4 oferty, OF/2026/0001 ma tylko v1 wysłaną). Serwer startuj dopiero tuż przed nagraniem (patrz recap w ADR), pierwsze wejście na każdy ekran kompiluje się kilkanaście sekund — **przeklikaj raz wszystkie sceny przed włączeniem nagrywania**.

## Sceny

| # | Scena | Co klikam | Co mówię (kierunek) | Zrzut | Czego nie pokazywać |
|---|---|---|---|---|---|
| 1 | Lista ofert | Oferty złożone → **Oferty** | Cztery oferty, cztery statusy: robocza, wysłana, przyjęta, odrzucona. Kolumna „Wersja” — jedna oferta ma już v2. Wartość liczona z pozycji, nie wpisywana ręcznie. | 01 | Nie otwieraj menu „Perspektywy” (puste widoki). |
| 2 | Cennik modelu | Oferty złożone → **Modele i cenniki** → **Poduszka na ławkę na wymiar** | Model to nie produkt z katalogu, tylko przepis na cenę: cena bazowa (robocizna i narzut), marża, zużycie tkaniny. Koszt materiałów nie jest wpisany z głowy — przychodzi z BOM. | 02 | Pole „Marża %” można pokazać — ale powiedz, że to dana wewnętrzna i nie trafia na wydruk. |
| 3 | Koszt z BOM | Klik **Pobierz aktualny koszt z BOM** (górny przycisk) | Jeden klik: moduł ofert pyta moduł BOM o koszt wyrobu PO-120. Zmienisz cenę gąbki w BOM — tu klikasz i oferta liczy się z nowej. Komunikat mówi skąd i ile (82,10 zł). | 03 | — |
| 4 | Parametry i dopłaty | Przewiń do **Cennik — parametry i dopłaty** | Wymiar ma współczynnik materiału (150×60 = ×1,25), tkanina ma cenę za metr, dodatki stałą dopłatę, a niżej progi rabatu: od 10 szt. 3%, od 25 — 5%, od 50 — 8%. To są reguły, nie tabelka cen do przepisywania. | 04 | Nie zapisuj cennika na nagraniu (zmieni kwoty w dalszych scenach). |
| 5 | Wysłana oferta jest zablokowana | Oferty złożone → **Oferty** → **OF/2026/0001 Pensjonat Leśna Polana** | v1 wysłana 3 dni temu. Kłódka i baner: klient ma dokładnie te ceny, edytować się nie da — nie przez ukryty przycisk, serwer odmawia. Rozwiń **Skąd ta cena?** na pozycji 1: cena bazowa, dopłata za wymiar, materiały z BOM ×1,25, tkanina 1,813 m × 38,50, marża, rabat 3% → 318,74 zł/szt. | 05, 06 | — |
| 6 | Nowa wersja | Klik **Nowa wersja (v2)** | Klient dzwoni: „a w paski?”. Nie poprawiam wysłanej oferty — robię v2. Komunikat: v1 pozostaje bez zmian. Zakładki: v2 robocza, v1 wysłana. | 07 | — |
| 7 | **MOMENT WOW** — zmiana tkaniny | Na pozycji 1 w polu **Tkanina** wybierz **Tkanina outdoor grafit w paski · 46,00 zł/m**; rozwiń **Skąd ta cena?**; przewiń do sumy | Zmieniam jeden parametr. Pozycja przelicza się od razu: 7649,76 → **8077,20 zł**, plakietka **+427,44 zł**. W rozbiciu żółtym podświetlone jest wszystko, co się ruszyło — tkanina 69,78 → 83,38, za nią marża, rabat i cena za sztukę — ze starą wartością przekreśloną obok. Suma oferty: 20 842,14 → **21 269,58 zł netto**, a pod nią „względem v1 (wysłana): + 427,44 zł”. | 08, 09 | Nie zmieniaj ilości ani innej pozycji przed tą sceną — liczby w narracji przestaną się zgadzać. |
| 8 | v1 nietknięta, wysyłka v2, PDF | Klik zakładki **v1** → potem **v2** → **Wyślij do klienta** → potwierdź → **PDF v2** | v1 wciąż 20 842,14 zł i stara tkanina — to, co klient dostał, nie zmieniło się ani o grosz. Wysyłam v2: okno ostrzega, że wersja się zablokuje. PDF: parametry, ilości, ceny jednostkowe z informacją o rabacie, VAT, brutto 26 161,58 zł — **bez** marży i rozbicia (to zostaje u nas). | 10, 11, 12, 13 | W oknie PDF nie klikaj „Drukuj” na nagraniu, jeśli systemowe okno druku pokazuje Twoje drukarki/konto. |

## Liczby do sprawdzenia na ekranie

- Pozycja 1 (24 szt. poduszki na ławkę 150×60, wiązania), tkanina szara: 318,74 zł/szt., **7649,76 zł** (rabat 3%).
- Ta sama pozycja, tkanina grafit w paski: 336,55 zł/szt., **8077,20 zł**, różnica **+427,44 zł**.
- Rozbicie po zmianie: 55,00 + 10,00 + 102,63 + 83,38 + 0,00 + 6,00 = 257,01 → marża 35% 89,95 → 346,96 → rabat −10,41 → 336,55.
- Oferta: v1 **20 842,14 zł** netto → v2 **21 269,58 zł** netto, brutto v2 **26 161,58 zł**.
- Te liczby pilnuje test jednostkowy (`__tests__/pricing.test.ts`) i skrypt `capture-scenes.cjs` — jeśli ktoś zmieni seed, test powie to przed nagraniem.

## Czego nie pokazywać / bezpieczeństwo ekranu

- Wszystkie nazwy klientów, modeli i ceny są zmyślone; kontakty to role („Dział zakupów”), nie osoby. Test `demo-data-is-generic` pilnuje, żeby nie trafiła tam nazwa żadnego klienta.
- Przełącznik organizacji pokazuje „Acme Corp” — to dane przykładowe Open Mercato; ta nazwa jest też sprzedawcą na PDF.
- Nie otwieraj konsoli przeglądarki ani DevTools (w konsoli są nieistotne 401 z widżetów powiadomień).
- Nie mów „oficjalny moduł Open Mercato” — to moduł społecznościowy na forku repozytorium.
- Nie zaglądaj do menu **Sprzedaż → Oferty** z rdzenia Open Mercato (to inny, wbudowany moduł o tej samej nazwie) — nasze są w grupie **Oferty złożone**.
