# Plan nagrania — moduł BOM dla produkcji mebli (Open Mercato)

Demo: `http://localhost:3017`, login `superadmin@acme.com` / `secret`, menu boczne → grupa **Produkcja**.
Rozdzielczość nagrania 1440×900. Zrzuty referencyjne leżą obok tego pliku (numery w nawiasach).

Przed nagraniem: `node docs/recording/reset-demo.cjs` przywraca dane „na czysto” (usuwa „Rzep 20 mm” dodany w scenie 5 i kopie z duplikowania). Uruchom go po każdej próbie. Stan na 24.11 rano: dane czyste.

| # | Scena | Co kliknąć | Co widać | Jedna myśl do powiedzenia |
|---|---|---|---|---|
| 1 | Materiały | Produkcja → **Materiały** | Lista: gąbki, zamki, sznurek, nici, tkaniny z ceną za jednostkę; tkaniny z plakietką „poza kosztem wyrobu”; kolumna Naddatek (01) | „Najpierw słownik materiałów: każdy ma jednostkę i cenę — metr, sztuka, kilogram.” |
| 2 | Materiał i „gdzie używany” | Klik **Zamek spiralny 5 mm (metraż)**, przewiń w dół | Formularz (jednostka m, cena, naddatek 5%), niżej „Gdzie używany”: 3 wyroby z ilością i liczbą odcinków (02, 03) | „Zanim zmienisz cenę zamka, widzisz, których wyrobów to dotknie.” |
| 3 | Wyroby z kosztem | Produkcja → **Wyroby (BOM)** | Lista z kolumną „Koszt materiałów / szt.” i czasem robocizny (04) | „Każdy wyrób od razu pokazuje, ile kosztuje w materiale — liczone z aktualnych cen.” |
| 4 | Wyrób: czas osobno, tkanina osobno | Klik **Poduszka na krzesło ogrodowe 45×45** | Pola: czas robocizny 18 min i zużycie tkaniny 0,55 m — z podpowiedziami, że to nie jest BOM (05) | „Czas pracy i tkanina są osobno — tkaninę wybiera się dopiero przy zamówieniu.” |
| 5 | Edytor BOM | Przewiń do „Lista materiałów (BOM)”, **Dodaj materiał** → Rzep 20 mm, ilość `0,3` → **Zapisz BOM** | Pozycje z ilością w jednostce materiału, koszt pozycji, suma „Koszt materiałów 1 szt.” rośnie z 23,00 do 24,08 zł; komunikat „BOM zapisany” (06, 07, 08) | „Dodaję materiał — koszt wyrobu przelicza się na żywo.” |
| 6 | Odcinki zamiast sumy metrów | Otwórz **Poduszka na ławkę ogrodową 120×60** | Zamek jako `3 × 1,4 m = 4,2 m`, przycisk **Podziel** (10) | „Szwalnia tnie kawałki, nie metry — zamek to trzy odcinki po 1,40.” |
| 7 | 200 sztuk | Wróć do poduszki 45×45, sekcja „Zapotrzebowanie”, ilość `200`, tkanina **Tkanina outdoor szara** | Norma × 200, naddatek, „Do wydania” (tkanina: 110 m wg normy → 121 m z naddatkiem 10%), odcinki do cięcia `800 × 0,5 m`, robocizna 60 h; tkanina osobnym wierszem „poza kosztem wyrobu” (09, 11) | „200 poduszek: ile metrów zamka, ile gąbki, ile tkaniny — i ile kawałków uciąć.” |
| 8 | Duplikowanie | Lista wyrobów → ⋯ przy poduszce 45×45 → **Duplikuj wyrób**, nazwa „… 50×50”, kod `PO-50` → **Duplikuj** | Okno z opisem; po zapisie komunikat „Skopiowano wyrób z 7 poz. BOM — ilości i odcinki przeniesione”, „Skopiowany z …”, BOM z tymi samymi ilościami i odcinkami (12, 13, 14) | „Nowy wariant w 5 sekund — z całym BOM-em, łącznie z odcinkami. I widać, że się udało.” |

## Liczby do sprawdzenia na ekranie

- Poduszka 45×45: 23,00 zł / szt. (po dodaniu rzepu 24,08 zł).
- 200 szt. poduszki 45×45 (z rzepem): materiały wg normy 4815,20 zł, do wydania z naddatkiem 4849,60 zł, robocizna 60 h 0 min.
- Tkanina szara dla 200 szt.: 110 m wg normy, 121 m do wydania (+10%), 4658,50 zł — poza kosztem wyrobu.

## Czego nie pokazywać / bezpieczeństwo ekranu

- Wszystkie nazwy i ceny w demo są zmyślone; nie ma w nich nazw klientów ani dostawców.
- Przełącznik organizacji pokazuje „Acme Corp” — to dane przykładowe Open Mercato.
