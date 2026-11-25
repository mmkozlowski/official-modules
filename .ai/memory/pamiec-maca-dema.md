---
name: pamiec-maca-dema
description: Przy kilku demach Open Mercato naraz — next dev z limitem 4 GB, gasić serwer i watcher po testach, żadnych równoległych buildów/Playwrighta
metadata:
  type: feedback
---

Polecenie Mateusza (25.11.2026): „pamiętaj żeby całej pamięci nie wyssać, pilnuj tego”. Serwer dev uruchamiaj tylko z
`NODE_OPTIONS=--max-old-space-size=4096`, gaś go (i `mercato generate watch`) zaraz po teście w przeglądarce; kod i testy
jednostkowe pisz bez serwera; buildy, typecheck i Playwright po kolei, nigdy równolegle; zrzuty jednym przebiegiem.
Kontener Postgres może zostać.

**Why:** Mac 48 GB ze swapem prawie pełnym; `next dev` sandboxa zjada 9–12 GB na sesję, a działały 3 dema naraz.
**How to apply:** wzorzec jednego przebiegu: start serwera w tle → `capture-scenes.cjs` → `pkill` + kontrola portu, w jednym
poleceniu. W recapie zawsze napisz, czy serwer jest wyłączony. Powiązane: [[demo-planowania-scenariusz]].
