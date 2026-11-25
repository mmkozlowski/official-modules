import { Migration } from '@mikro-orm/migrations';

export class Migration20261125140341_department_routing extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "department_routing_departments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "position" smallint not null default 0, "description" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "department_routing_departments_org_tenant_idx" on "department_routing_departments" ("organization_id", "tenant_id");`);

    this.addSql(`create table "department_routing_tasks" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_id" uuid not null, "order_line_id" uuid not null, "department_id" uuid not null, "order_number" text not null, "customer_name" text not null, "product_name" text not null, "due_date" date null, "quantity_required" int not null, "quantity_done" int not null default 0, "status" text not null default 'pending', "route_step" smallint not null default 0, "started_at" timestamptz null, "completed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "department_routing_tasks_department_idx" on "department_routing_tasks" ("department_id", "status");`);
    this.addSql(`create index "department_routing_tasks_order_idx" on "department_routing_tasks" ("order_id");`);

    this.addSql(`create table "department_routing_order_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_id" uuid not null, "product_id" uuid not null, "product_name" text not null, "quantity" int not null, "position" smallint not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "department_routing_order_lines_order_idx" on "department_routing_order_lines" ("order_id");`);

    this.addSql(`create table "department_routing_orders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "number" text not null, "customer_name" text not null, "due_date" date null, "status" text not null default 'new', "departments_done" smallint not null default 0, "departments_total" smallint not null default 0, "accepted_at" timestamptz null, "ready_at" timestamptz null, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "department_routing_orders_org_tenant_idx" on "department_routing_orders" ("organization_id", "tenant_id");`);

    this.addSql(`create table "department_routing_products" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "department_ids" jsonb not null default '[]', "description" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "department_routing_products_org_tenant_idx" on "department_routing_products" ("organization_id", "tenant_id");`);

    this.addSql(`create table "department_routing_task_reports" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "task_id" uuid not null, "order_id" uuid not null, "department_id" uuid not null, "quantity_delta" int not null, "reported_by" uuid null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "department_routing_task_reports_task_idx" on "department_routing_task_reports" ("task_id");`);
  }

}
