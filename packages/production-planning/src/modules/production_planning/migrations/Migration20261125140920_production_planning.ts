import { Migration } from '@mikro-orm/migrations';

export class Migration20261125140920_production_planning extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "production_planning_orders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "number" text not null, "product_id" uuid not null, "quantity" int not null, "due_date" date not null, "priority" text not null default 'normal', "status" text not null default 'planned', "fabric_material_id" uuid null, "reference" text null, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "production_planning_orders_due_idx" on "production_planning_orders" ("due_date");`);
    this.addSql(`create index "production_planning_orders_org_tenant_idx" on "production_planning_orders" ("organization_id", "tenant_id");`);

    this.addSql(`create table "production_planning_routing_steps" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "product_id" uuid not null, "work_center_id" uuid not null, "sequence" smallint not null default 0, "minutes_per_unit" numeric(10,2) not null, "setup_minutes" int not null default 0, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "production_planning_routing_steps_org_tenant_idx" on "production_planning_routing_steps" ("organization_id", "tenant_id");`);
    this.addSql(`create index "production_planning_routing_steps_product_idx" on "production_planning_routing_steps" ("product_id");`);

    this.addSql(`create table "production_planning_work_centers" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "stage" text not null default 'other', "daily_capacity_minutes" int not null default 480, "position" smallint not null default 0, "notes" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "production_planning_work_centers_org_tenant_idx" on "production_planning_work_centers" ("organization_id", "tenant_id");`);
  }

}
