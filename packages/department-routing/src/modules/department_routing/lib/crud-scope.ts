import type { CrudCtx } from '@open-mercato/shared/lib/crud/factory'
import type { Scope } from './order-service'

/** The scope a CRUD-factory hook runs in — same fallback as the factory itself (`selectedOrganizationId ?? auth.orgId`). */
export function scopeOfCrudCtx(ctx: CrudCtx): Scope | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  return tenantId && organizationId ? { tenantId, organizationId } : null
}
