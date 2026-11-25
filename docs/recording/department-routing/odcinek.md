---
typ: yt-odcinek
seria: openmercato
numer: null
tytul_roboczy: "Zamówienie, które samo rozchodzi się po działach — Open Mercato dla produkcji"
tytul_yt: null
status: propozycja
brand: mateusz-kozlowski
format: long-form
czas_docelowy: 10-12 min
funnel: consideration
data_utworzenia: 2026-11-25
tags: [content, youtube, openmercato, produkcja, meble, dzialy, make-to-order]
---

# Zamówienie, które samo rozchodzi się po działach

> Propozycja karty od agenta budującego moduł (25.11). Odcinek jest kolejny po BOM (odc. 14) i dzieje się
> w tej samej fikcyjnej firmie: mały warsztat mebli ogrodowych. Numer odcinka i tytuł YT ustala Mateusz.
> Wartości w nawiasach kwadratowych czekają na głosówkę.

## Teza (kierunek)
W firmie, która robi na zamówienie, najwięcej czasu nie idzie na produkcję, tylko na pytanie „na jakim to jest
etapie?”. Jeśli zamówienie samo rozbija się na działy, a działy same odhaczają, co zrobiły, to biuro przestaje
dzwonić na halę.

## Dla kogo
Właściciel albo kierownik produkcji w firmie meblowej, tapicerskiej czy stolarskiej, która robi na zamówienie
klienta i ma 3–6 działów. Dziś zamówienie chodzi po hali na kartce, a status zna tylko ten, kto ostatni ją widział.

## Hook (kierunek, w głosie Mateusza)
`[Jedna kartka, pięć działów i zero wiedzy, gdzie jest zamówienie]`
„Tej jednej kartki zamówienia dotyka kilka, kilkanaście osób.” Te słowa Mateusz już powiedział w głosówce
o procesach, więc to dobry punkt wyjścia. Dalej pytanie, które zna każdy właściciel: „Na jakim etapie jest
zamówienie dla pensjonatu?” i trzy telefony, żeby się dowiedzieć. Na ekranie od razu obietnica: za 8 minut
pokażę, jak zamówienie samo mówi, że jest „2 z 4 działów”.

## Pięć segmentów
1. **Jak to wygląda dziś (kartka i telefon)** — zamówienie przyjęte w biurze, rozpisane ręcznie na stolarnię,
   lakiernię, tapicernię i pakowanie. Status ustala się telefonem. `[DO POTWIERDZENIA: przykład z warsztatu Mateusza
   z przejściem z kartką po działach — bez nazwy klienta]`
2. **Raz ustawiasz, kto co robi** — działy i routing produktu: ławka idzie przez cztery działy, poduszka przez
   dwa. To robota na kwadrans, a potem system wie, komu dać zadanie. (Sceny 1–2 z planu nagrania.)
3. **Demo: przyjęcie zamówienia → rozbicie** — zamówienie ZAM/2026/0141 przed przyjęciem pokazuje, gdzie trafi.
   Jedno kliknięcie i powstaje 5 zadań w 4 działach. (Sceny 3–4.)
4. **Moment wow: działy odhaczają, status liczy się sam** — tablica działu, odhaczanie części („+1”, „3 sztuki”),
   potem dwa okna obok siebie: stolarnia i tapicernia kończą, a zamówienie bez odświeżania pokazuje „W realizacji
   2/4 działy”. Na końcu pakowanie i „Gotowe do wysyłki”. (Sceny 5–7.)
5. **Czego to nie załatwia i od czego zacząć** — to nie jest planowanie mocy, kolejność działów nie blokuje pracy,
   nie ma tu czasu pracy ani magazynu. Zaczynasz od spisania działów i od tego, który produkt przez nie przechodzi.
   Wtedy widać, czy w ogóle potrzebujesz systemu, czy wystarczy kartka. Uczciwie, bez sprzedawania na siłę.

## CTA
Konsultacja „20 minut rozmowy”: przejdźmy razem jedno Twoje zamówienie od biura do wysyłki i zobaczmy, gdzie
ginie informacja. Zapowiedź następnego odcinka z serii produkcji `[DO USTALENIA: planowanie / oferty]`.

## Ekrany
- **Demo:** http://localhost:3020/backend/department-routing/orders · login `superadmin@acme.com` / `secret` · menu **Produkcja**
- **Plan nagrania (8 scen + zrzuty):** `docs/recording/department-routing/plan-nagrania.md`
- **Przed każdą próbą:** `node docs/recording/department-routing/reset-demo.cjs`
- **Moment wow:** dwa okna tablic działów obok siebie (Stolarnia | Tapicernia), zamówienie w trzecim oknie. Niczego nie odświeżaj ręcznie.

## Czego nie pokazywać / nie mówić
- nie mów „oficjalny moduł Open Mercato” — to moduł demo w forku `official-modules`; samo repo jest archiwalne
- żadnych nazw klientów, osób ani prawdziwych cen; w demo klienci są opisani rodzajem i miastem
- nie obiecuj planowania ani harmonogramu działów — tego moduł nie robi (segment 5 mówi to wprost)

## Stan produkcji
- [x] moduł gotowy do próby (25.11), gałąź `feat/department-routing`
- [x] plan nagrania + zrzuty
- [ ] głosówka / pytania
- [ ] skrypt
- [ ] nagrane (planowo 29.11, seria jednym ciągiem)
