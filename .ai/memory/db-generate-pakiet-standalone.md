---
name: db-generate-pakiet-standalone
description: mercato db generate pomija encje pakietu z packages/ gdy istnieje dist — obejście
metadata:
  type: project
---

W tym repo sandbox działa w trybie „standalone” (brak `apps/mercato`), więc dla modułu z pakietu CLI szuka `entities.ts` w `dist/modules/<id>/data` i po cichu nic nie generuje.

**Why:** przy module `complex_offers` (25.11.2026) `yarn mercato db generate` wypisał tylko moduły `@app`.

**How to apply:** `touch packages/<pkg>/dist/modules/<id>/data/entities.ts` → `yarn mercato db generate` → usuń ten plik → skopiuj `Migration*.ts` i `.snapshot-open-mercato.json` z `dist/.../migrations` do `src/.../migrations` → `rm -rf dist` i build (inaczej dwie kopie migracji i „relation already exists”). Zob. [[zod-partial-zachowuje-defaulty]].
