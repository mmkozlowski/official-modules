import { NextResponse } from 'next/server'
import type { AwilixContainer } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import {
  resolveOrganizationScopeForRequest,
  type OrganizationScope,
} from '@open-mercato/core/modules/directory/utils/organizationScope'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RequestScope = {
  tenantId: string
  organizationId: string
  actorUserId: string | null
  container: AwilixContainer
  em: EntityManager
}

export type ScopeResolution =
  | { ok: true; scope: RequestScope }
  | { ok: false; response: NextResponse }

/**
 * Tenant and organisation for a custom (non-CRUD-factory) route, resolved the
 * way `makeCrudRoute` resolves them: the organisation picked in the switcher
 * wins, the token's own organisation is the fallback, and a request that
 * resolves to no organisation at all is refused rather than widened.
 */
export async function resolveRequestScope(request: Request): Promise<ScopeResolution> {
  const auth = await getAuthFromRequest(request)
  if (!auth) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const container = await createRequestContainer()
  let scope: OrganizationScope | null = null
  try {
    scope = await resolveOrganizationScopeForRequest({ container, auth, request })
  } catch {
    // Degrade to the token's own scope rather than to no scope — never widen on error.
    scope = null
  }
  // Same fallback as the CRUD factory (`selectedOrganizationId ?? auth.orgId`), so
  // a custom route and a list route always agree on which organisation a record
  // belongs to — including for a super-admin with no organisation picked.
  const tenantId = (scope ? scope.tenantId : auth.tenantId) ?? auth.tenantId ?? null
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!tenantId || !organizationId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Organization scope required' }, { status: 403 }),
    }
  }
  return {
    ok: true,
    scope: {
      tenantId,
      organizationId,
      actorUserId: auth.sub ?? null,
      container,
      em: container.resolve('em') as EntityManager,
    },
  }
}

export function requireUuidParam(value: unknown): { ok: true; id: string } | { ok: false; response: NextResponse } {
  if (typeof value === 'string' && UUID_PATTERN.test(value)) return { ok: true, id: value }
  return { ok: false, response: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
}
