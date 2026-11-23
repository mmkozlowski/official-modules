# @open-mercato/production-bom

Bill of materials for small furniture and upholstery workshops: **materials** with a unit, a net price and a cutting allowance; **products** with a BOM, a labour time and a fabric consumption; the **material cost** of one unit; the **requirement for N units** (what to issue from the warehouse, with a cut list); **duplicating** a product together with its BOM; **where used** for a material.

Module id `production_bom`. Pages under `/backend/production-bom/products` and `/backend/production-bom/materials`, sidebar group *Production*.

## What it owns

| Entity | Table | What it is |
|---|---|---|
| `Material` | `production_bom_materials` | Fabric, foam, zipper, accessory, packaging… Unit (`m`, `m2`, `pcs`, `kg`), net unit price `numeric(14,4)`, allowance `waste_percent`. |
| `Product` | `production_bom_products` | What the workshop makes. Labour minutes and fabric consumption per unit live here, **not** in the BOM. Optional `catalog_product_id` (plain id) for a later link to `catalog`. |
| `BomLine` | `production_bom_bom_lines` | Material + quantity for ONE unit, `numeric(13,6)`. Optional split into pieces (`segment_count` × `segment_length`). |

## API

| Route | What |
|---|---|
| `GET/POST/PUT/DELETE /api/production_bom/materials` | CRUD (query-indexed, export enabled, search by name/code, filters type/unit/active). |
| `GET /api/production_bom/materials/{id}/usage` | Where used: products whose BOM contains the material. |
| `GET/POST/PUT/DELETE /api/production_bom/products` | CRUD; list rows carry `material_cost` and `bom_line_count`, computed from live prices on every read. |
| `GET/PUT /api/production_bom/products/{id}/bom` | Read / replace the whole BOM in one transaction. Fabric is refused (`422 fabric_not_in_bom`). |
| `POST /api/production_bom/products/{id}/duplicate` | Deep copy with the BOM, quantities and pieces; one transaction; indexed like a factory create. |

Events: `production_bom.product.duplicated`, `production_bom.product.bom_updated` plus CRUD events.

## Decisions

1. **Own entities, not `catalog` products.** Core `catalog` bundles/grouped products express a *sales* composition with integer quantities. A BOM needs fractional quantities in a material's unit (1.17 m of zipper, 0.004 kg of thread), prices of components and labour kept apart. A product can be linked to a catalog product later through `catalog_product_id`.
2. **Quantity `numeric(13,6)`, not `(12,3)`.** Thread and glue per unit are fractions of a kilogram; three decimals round them to zero. Arithmetic runs on scaled integers (BigInt) in `lib/bom-calculations.ts`, shared by API and UI — `0.45 × 200` is exactly `90`.
3. **A BOM line has no unit of its own.** It is always in its material's unit, so a quantity cannot be entered in the wrong unit.
4. **Labour time is a product field, not a BOM line.** Minutes are not bought and must not be summed into the material cost.
5. **Fabric is outside the BOM and outside the product cost.** A product is defined before anyone knows what it will be sewn from, and the fabric is chosen per order. The product stores only *how much* fabric one unit takes (`fabric_consumption`); the requirement calculator takes the fabric chosen for the order and reports it on its own row, never in the material cost. The BOM endpoint refuses fabric materials.
6. **Norm vs. consumption (allowance).** `waste_percent` sits on the material (offcuts come from how a material is cut). The product cost uses the **norm**; the requirement for N units shows the norm, the allowance and the quantity **to issue** = norm × N × (1 + allowance/100), rounded half-up to 6 decimals; its cost is the issued quantity × price. Both totals are shown: *materials at norm* (= N × unit cost) and *materials to issue*.
7. **Split into pieces.** The sewing room cuts pieces, not a sum of metres: a line can be `3 × 1.40 m`. The server derives the quantity from the pieces, so they cannot drift apart; the requirement shows a cut list (`600 × 1.4 m`).
8. **Duplicate = deep copy with visible feedback.** Fields, labour time, fabric consumption and every line with its quantity **and** pieces, in one transaction; code and catalog link are not copied; `source_product_id` remembers the origin. The UI says how many lines were copied, or that nothing was saved.
9. **The BOM is written as a whole** (`PUT …/bom`), so there is no per-line CRUD whose partial failures could leave a half-saved recipe.

## Running it in the sandbox

The sandbox resolves this package as a regular dependency (standalone mode), so it runs the **built** `dist/`:

```bash
yarn workspace @open-mercato/production-bom build   # after every source change
yarn generate
yarn mercato db migrate
```

### Regenerating the migration and entity ids

Standalone mode reads entities from `dist/`, where the CLI does not look for `entities.ts`, so `db generate` and `generate entity-ids` skip the package. Run them with the module temporarily registered as an app module:

```bash
cd apps/sandbox
ln -s ../../../../packages/production-bom/src/modules/production_bom src/modules/production_bom
# in src/modules.ts: { id: 'production_bom', from: '@app' }
yarn mercato db generate            # writes migrations/ into the package
yarn mercato generate entity-ids    # then copy .mercato/generated/entities/{material,product,bom_line}
# revert src/modules.ts, remove the symlink, update packages/production-bom/generated/
```

`generated/` is committed because standalone hosts read the entity ids from it.

## Example data

`setup.ts → seedExamples` seeds 18 materials and 5 products for a garden-furniture workshop (invented names and prices), once per organisation. `__tests__/demo-data-is-generic.test.ts` fails if a known real client, supplier or brand name appears in the seed or the locale files.

## Known gaps

- `de` / `es` locale files are English copies.
- No per-order document yet: the requirement is a calculator, not a saved production order.
- Sets (a product composed of products) are not modelled.
