---
name: db-generate-standalone
description: yarn mercato db generate i generate entity-ids po cichu pomijają moduły z pakietów w sandboxie (standalone)
metadata:
  type: reference
---

W `apps/sandbox` (tryb standalone) CLI szuka `data/entities.ts` w `dist` pakietu, więc `db generate` nie wypisuje nic dla
modułu z `packages/*` — bez błędu. Obejście: symlink `apps/sandbox/src/modules/<id>` → `packages/<pkg>/src/modules/<id>`,
w `src/modules.ts` tymczasowo `from: '@app'`, wtedy `yarn mercato db generate` + `yarn mercato generate entity-ids`,
skopiuj `.mercato/generated/entities/<encje>` do `packages/<pkg>/generated/`, przywróć `modules.ts`, usuń symlink.
Uwaga: `yarn mercato init --help` NIE pokazuje pomocy — wykonuje pełny init.

Opisane też w README `production-bom` i `production-planning`.
