# @open-mercato/production-planning

Production planning for small furniture and upholstery workshops, on top of `@open-mercato/production-bom`:
**work centres** with a daily capacity in minutes, a **routing** per BOM product (which work centres, in which
order, minutes per unit), **production orders** (product × quantity × due date), a **plan** scheduled backwards
from each due date with the **load of every work centre per day**, and the **material requirements** of the
orders in the window, computed from the BOM.

Module id `production_planning`, requires `production_bom`. Pages under `/backend/production-planning/*`
(plan, orders, work centres, routings), sidebar group *Production* next to the BOM pages.

## What it owns

| Entity | Table | What it is |
|---|---|---|
| `WorkCenter` | `production_planning_work_centers` | Cutting room, sewing room, packing… Stage, daily capacity in minutes, position on the plan. |
| `RoutingStep` | `production_planning_routing_steps` | One step of a product's routing: work centre, sequence, minutes per unit, setup minutes per order. `product_id` is a plain uuid of a `production_bom` product. |
| `ProductionOrder` | `production_planning_orders` | Number `ZP/<year>/<seq>`, product, quantity, due date, priority, status, fabric chosen for the order. |

Operations are **not stored** — they are derived from the routing every time the plan is read.

## API

| Route | What |
|---|---|
| `GET/POST/PUT/DELETE /api/production_planning/work-centers` | CRUD, export. |
| `GET/POST/PUT/DELETE /api/production_planning/orders` | CRUD, export; list rows carry product name, planned start, `on_overloaded_day`, `starts_in_past`. Number assigned when omitted. |
| `POST /api/production_planning/orders/{id}/reschedule` | Moves the due date, returns overloaded work-centre days before and after. Emits `order.rescheduled`. |
| `GET /api/production_planning/plan?from&days` | Plan input + computed plan (schedule, load, requirements). |
| `GET /api/production_planning/routings`, `GET/PUT …/routings/{productId}` | Routing summaries; read / replace one routing. |

## Decisions

See `ai/decisions/2026-11-25-production-planning-backward-schedule.md`. In short:

1. **Backward scheduling, infinite capacity.** The last step ends on the due date; overload is shown, never levelled
   silently. Deciding what moves is the planner's job.
2. **Plan computed in the browser from the same pure functions** (`lib/schedule.ts`, `lib/plan-model.ts`) the server
   uses — a moved due date repaints instantly; the save runs behind and is rolled back on refusal.
3. **Integration with BOM, not a copy:** products, BOM lines and materials are read from `production_bom`;
   requirements go through its `computeRequirements`.
4. **Working days Mon–Fri**, no holiday calendar.

## Running it in the sandbox

Standalone mode runs the built `dist/` (same as the BOM module):

```bash
yarn workspace @open-mercato/production-planning build   # after every source change
yarn generate
yarn mercato db migrate
```

Regenerating the migration and entity ids: same trick as the BOM README — temporarily register the module as
`@app` with a symlink in `apps/sandbox/src/modules/`, run `yarn mercato db generate` and
`yarn mercato generate entity-ids`, copy `.mercato/generated/entities/{work_center,routing_step,production_order}`
into `generated/`, revert.

## Example data and the recording

`lib/demo-data.ts` — five work centres, routings for the five BOM demo products and 16 orders with due dates
**relative to the day of seeding** (working days). Seeded by `setup.ts → seedExamples`; rebuilt for a recording by
`docs/recording/production-planning/reset-demo.cjs`. `__tests__/recording-scenario.test.ts` guards the episode:
no overload at the start, red after the two live moves, green after the fix.

## Known gaps

- `de` / `es` locale files are English copies.
- No capacity levelling, no holidays, no partial progress per operation (status is per order).
- Order numbering counts live orders only (deterministic after a demo reset; a deleted number can be reused).
