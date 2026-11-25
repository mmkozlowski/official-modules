# @open-mercato/department-routing

Make-to-order production split across departments. A customer order is accepted and **splits itself into department tasks** according to each product's routing (product → ordered list of departments: joinery, paint shop, upholstery, packing…). Every department has its own board and reports done quantities — also partial. The order's status recomputes itself: `new` → `in_progress` ("2/4 departments") → `ready_to_ship` when every department has finished.

Demo module built on Open Mercato for the "Open Mercato for production" video series (same fictional garden-furniture workshop as `@open-mercato/production-bom`).

## What it does

| Screen | URL |
|---|---|
| Production orders (full `DataTable`: search, status filter, sort, column chooser, export, bulk accept/delete, live refresh) | `/backend/department-routing/orders` |
| Order: lines + where they will go (while `new`), accept, then live per-department progress | `/backend/department-routing/orders/{id}` |
| Department board: To do / In progress / Done, report `+1`, a typed amount or "all" | `/backend/department-routing/board?department={id}` |
| Departments, product routing (ordered departments per product) | `/backend/department-routing/departments`, `/products` |

| API | |
|---|---|
| `GET/POST/PUT/DELETE /api/department_routing/{departments,products,orders}` | CRUD factory, export enabled |
| `PUT /api/department_routing/orders/{id}/lines` | replace lines of a `new` order (409 once accepted) |
| `POST /api/department_routing/orders/{id}/accept` | split into tasks; 422 `no_lines` / `no_routing` (+ product name) |
| `GET /api/department_routing/orders/{id}/progress` | order + lines + departments with tasks |
| `GET /api/department_routing/tasks?departmentId=` | department board feed |
| `POST /api/department_routing/tasks/{id}/report` | `{ add: n }` or correction `{ set: n }`; 422 `over_required` |

## Rules (see `lib/routing.ts`, unit-tested)

1. **One task per order line per department on the product's routing.** A product without departments stops the acceptance with its name — nothing is half-split.
2. **Partial work is the normal state.** A report adds units; more than required is refused (not clamped); a correction may go down and reopens the task — and moves a ready order back to `in_progress`.
3. **Status is derived, never clicked.** A department is done with an order when all its tasks are done; the order is `ready_to_ship` when all its departments are.
4. **Concurrency:** accept and report lock the order row (`SELECT … FOR UPDATE`) before reading tasks, so two departments reporting in the same second cannot both miss each other's finished department.
5. **Routing order is informational** — it sorts departments on screen and does not block anyone (no sequencing/capacity planning in this module).
6. **Live screens:** lifecycle events (`order.accepted`, `task.reported`, `order.ready_to_ship`) are `clientBroadcast`; screens listen with `useAppEvent` and also poll every 2–5 s while visible, so a second window updates even without the event stream.

## Running it in the sandbox

Standalone mode — the sandbox runs the built `dist/`:

```bash
yarn workspace @open-mercato/department-routing build   # after every source change
yarn generate
yarn mercato db migrate
```

Regenerating the migration and entity ids: same procedure as `production-bom` (temporarily symlink the module into `apps/sandbox/src/modules` and register it `from: '@app'`, run `yarn mercato db generate` and `yarn mercato generate entity-ids`, copy `.mercato/generated/entities/<entity>/` into `generated/`, revert).

## Example data and reset

`setup.ts → seedExamples` seeds 5 departments, 6 products with routing and 5 orders in every state (once per organisation). The order for the recording is **ZAM/2026/0141** (`new`, splits into 5 tasks in 4 departments).

`yarn mercato department_routing reset-demo [--org <uuid>]` wipes **this module's** tables in the organisation and seeds again with due dates relative to today. `docs/recording/department-routing/reset-demo.cjs` wraps it.

`__tests__/demo-data-is-generic.test.ts` fails if a known real client, supplier or brand name appears in the seed, the locale files or the recording docs.

## Known gaps

- `de` / `es` locale files are English copies.
- Order header (customer, due date) is edited only at creation; no edit form on the order screen yet.
- The menu group reuses the BOM module's `production_bom.nav.group` key so both sit under one "Production" group.
