import { Migration } from '@mikro-orm/migrations';

export class Migration20261125140618_complex_offers extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "complex_offers_offers" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "number" text not null, "title" text not null, "customer_name" text not null, "contact_person" text null, "customer_id" uuid null, "valid_until" timestamptz null, "notes" text null, "current_version_number" int not null default 1, "status" text not null default 'draft', "total_net" numeric(14,2) not null default '0', "currency_code" text not null default 'PLN', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "complex_offers_offers_org_tenant_idx" on "complex_offers_offers" ("organization_id", "tenant_id");`);

    this.addSql(`create table "complex_offers_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "offer_id" uuid not null, "version_id" uuid not null, "model_id" uuid not null, "model_name" text not null, "quantity" int not null default 1, "selection" jsonb not null, "selected" jsonb not null, "breakdown" jsonb not null, "list_unit_price" numeric(14,2) not null default '0', "discount_percent" numeric(5,2) not null default '0', "unit_price" numeric(14,2) not null default '0', "line_total" numeric(14,2) not null default '0', "position" smallint not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "complex_offers_lines_version_idx" on "complex_offers_lines" ("version_id");`);

    this.addSql(`create table "complex_offers_versions" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "offer_id" uuid not null, "version_number" int not null, "status" text not null default 'draft', "source_version_id" uuid null, "total_net" numeric(14,2) not null default '0', "vat_amount" numeric(14,2) not null default '0', "total_gross" numeric(14,2) not null default '0', "sent_at" timestamptz null, "decided_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "complex_offers_versions_offer_idx" on "complex_offers_versions" ("offer_id");`);

    this.addSql(`create table "complex_offers_models" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "description" text null, "base_price" numeric(14,2) not null default '0', "margin_percent" numeric(5,2) not null default '0', "bom_product_code" text null, "bom_material_cost" numeric(14,2) not null default '0', "bom_cost_refreshed_at" timestamptz null, "fabric_consumption" numeric(10,3) not null default '0', "quantity_discounts" jsonb null, "currency_code" text not null default 'PLN', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "complex_offers_models_org_tenant_idx" on "complex_offers_models" ("organization_id", "tenant_id");`);

    this.addSql(`create table "complex_offers_model_options" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "model_id" uuid not null, "kind" text not null, "label" text not null, "surcharge" numeric(14,2) not null default '0', "size_factor" numeric(6,3) not null default '1', "fabric_price_per_meter" numeric(14,2) not null default '0', "is_default" boolean not null default false, "position" smallint not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "complex_offers_model_options_model_idx" on "complex_offers_model_options" ("model_id");`);
  }

}
