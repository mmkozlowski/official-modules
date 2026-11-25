---
name: dev-server-limit-pamieci
description: next dev sandboxa zjada 9–12 GB — limit 4 GB, gasić po testach, Playwright i buildy tylko po kolei
metadata:
  type: feedback
---

Polecenie MK 25.11.2026: „pamiętaj żeby całej pamięci nie wyssać, pilnuj tego”. Serwer startuj jako
`NODE_OPTIONS=--max-old-space-size=4096 yarn dev`. Kod i testy jednostkowe pisz bez działającego serwera.
Zrzuty i testy w przeglądarce rób jednym przebiegiem, a serwer i watcher gaś zaraz po nich. Żadnych
równoległych buildów, renderów ani Playwrighta w tle. Kontener Postgres może zostać.

**Why:** Mac 48 GB, swap prawie pełny przy trzech demach naraz.
**How to apply:** w recapie zawsze napisz, czy serwer jest wyłączony. Zobacz też [[demo-moduly-produkcji-porty]].
