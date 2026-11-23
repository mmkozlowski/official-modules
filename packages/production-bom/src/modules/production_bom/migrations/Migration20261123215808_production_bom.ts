import { Migration } from '@mikro-orm/migrations';

export class Migration20261123215808_production_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "production_bom_bom_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "product_id" uuid not null, "material_id" uuid not null, "quantity" numeric(13,6) not null, "segment_count" int null, "segment_length" numeric(13,6) null, "position" smallint not null default 0, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "production_bom_bom_lines_material_idx" on "production_bom_bom_lines" ("material_id");`);
    this.addSql(`create index "production_bom_bom_lines_product_idx" on "production_bom_bom_lines" ("product_id");`);

    this.addSql(`create table "production_bom_materials" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "material_type" text not null default 'other', "unit" text not null default 'pcs', "unit_price" numeric(14,4) not null default '0', "waste_percent" numeric(5,2) not null default '0', "currency_code" text not null default 'PLN', "notes" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "production_bom_materials_org_tenant_idx" on "production_bom_materials" ("organization_id", "tenant_id");`);

    this.addSql(`create table "production_bom_products" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "product_type" text not null default 'other', "fabric_consumption" numeric(13,6) not null default '0', "labor_minutes" int not null default 0, "description" text null, "source_product_id" uuid null, "catalog_product_id" uuid null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "production_bom_products_org_tenant_idx" on "production_bom_products" ("organization_id", "tenant_id");`);
  }

}
