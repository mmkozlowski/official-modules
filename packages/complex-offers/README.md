# @open-mercato/complex-offers

Offers for made-to-order furniture: **models** with a price list (base price, margin, quantity discount tiers, parameters with surcharges), **offers** whose lines are priced from the picked parameters with a full **price breakdown**, **versions** (v1, v2…) with a status flow **draft → sent → accepted | rejected** that freezes a sent version, and a **print view** (A4 HTML → "Save as PDF").

Module id `complex_offers`. Pages under `/backend/complex-offers/offers` and `/backend/complex-offers/models`, sidebar group *Complex offers*.

## Pricing formula (per unit)

```
  base price (labour and overhead)
+ size surcharge
+ BOM material cost × size factor
+ fabric consumption × size factor × fabric price per metre
+ colour surcharge + Σ add-on surcharges
= cost and surcharges
+ margin %                              → list price
− quantity discount % (best tier reached)
= unit price;   × quantity = line value
```

One pure function (`lib/pricing.ts`) prices on the server and renders the breakdown in the browser. Every step is rounded to grosze **before** it is added, so the steps always sum to the totals shown.

## What it owns

| Entity | Table | What it is |
|---|---|---|
| `PricedModel` | `complex_offers_models` | Base price, margin, fabric consumption, quantity discount tiers (json), and a **snapshot** of the material cost copied from the production BOM by product code. |
| `PricedModelOption` | `complex_offers_model_options` | One value of one parameter: `size` (with `size_factor`), `fabric` (price per metre), `color`, `addon` (any number). |
| `Offer` | `complex_offers_offers` | Number `OF/<year>/<seq>`, customer, subject, validity; mirrors the CURRENT version's number, status and net value for the list. |
| `OfferVersion` | `complex_offers_versions` | Status, totals (net, VAT 23%, gross), `source_version_id` for a copy. |
| `OfferLine` | `complex_offers_lines` | Model, quantity, selection, and the priced **snapshot**: breakdown, selected labels, unit price, line value. |

## Design decisions

- **A sent version is frozen on the server.** Line writes and header edits answer `409 version_locked` unless the version is a draft. A change after sending is `POST /versions/{id}/copy` — a new draft re-priced with the current rules; the source is not touched.
- **Lines store a snapshot.** What the customer received keeps rendering and printing the same, even after the price list or the BOM changes.
- **No shared tables with the BOM.** The model stores a BOM product *code* and a cost snapshot; "take current cost from BOM" calls the BOM module's public API from the browser. Without the BOM module the button reports it and nothing else breaks.
- **The print view never shows the breakdown** — base price, BOM cost and margin are internal.
- **Update schemas carry no defaults.** zod applies `.default()` inside `.partial()`, so an update schema derived from a create schema with defaults resets omitted fields. Guarded by `partial-update-keeps-fields.test.ts`.

## API

| Method & path | What |
|---|---|
| `GET/POST/PUT/DELETE /api/complex_offers/models` | CRUD (list adds per-parameter option counts) |
| `GET/PUT /api/complex_offers/models/{id}/rules` | Price list as the pricing engine takes it; PUT replaces options + discount tiers |
| `GET/POST/PUT/DELETE /api/complex_offers/offers` | CRUD; POST assigns the number and creates draft v1 |
| `GET /api/complex_offers/offers/{id}/view` | Offer with all versions and lines (with breakdowns) |
| `POST /api/complex_offers/versions/{id}/lines` | Add a line to a draft |
| `PUT/DELETE /api/complex_offers/lines/{id}` | Change parameters/quantity (re-prices) or remove |
| `POST /api/complex_offers/versions/{id}/status` | `sent` / `accepted` / `rejected` on the current version |
| `POST /api/complex_offers/versions/{id}/copy` | Next version from the current, non-draft one |
| `GET /api/complex_offers/versions/{id}/print` | A4 HTML document |

## Events

`complex_offers.version.created|sent|accepted|rejected`, `complex_offers.line.repriced`, `complex_offers.model.rules_updated`, plus CRUD events for offers and models. Together they measure versions per decision, win rate and how many re-pricings the system did instead of a person.

## Demo data

`setup.seedExamples` seeds 3 models and 4 offers (invented names, round invented prices). `yarn mercato complex_offers reset-demo` wipes this module's rows and seeds them again.
