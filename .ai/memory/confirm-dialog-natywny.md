---
name: confirm-dialog-natywny
description: useConfirmDialog z @open-mercato/ui renderuje natywny <dialog> — Playwright getByRole('dialog') go nie widzi
metadata:
  type: reference
---

`useConfirmDialog` otwiera natywny `<dialog>` przez `showModal()`. W Playwright `getByRole('dialog')` czeka
w nieskończoność; działa `page.locator('dialog[open]')`, a przycisk potwierdzenia ma nazwę „Potwierdź” / „Confirm”.

**Why:** pierwszy przebieg zrzutów (25.11.2026) utknął na tym kroku, choć okno było na ekranie.
**How to apply:** w skryptach e2e i capture używaj selektora `dialog[open]`.
