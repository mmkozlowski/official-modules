import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Organization } from '@open-mercato/core/modules/directory/data/entities'
import { PricedModel } from './data/entities'
import { clearComplexOffersData, seedComplexOffersExamples } from './lib/demo-seed'

function readFlag(rest: string[], name: string): string | undefined {
  const index = rest.indexOf(`--${name}`)
  if (index >= 0 && rest[index + 1] && !rest[index + 1].startsWith('--')) return rest[index + 1]
  const inline = rest.find((arg) => arg.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

/**
 * `mercato complex_offers reset-demo [--org <id> --tenant <id>]`
 *
 * Wipes this module's rows and seeds the demo again — models, rules and the
 * four example offers, with the first one's v1 sent and no v2. Without flags it
 * resets every organisation that has demo data (on a fresh database: every
 * organisation). Touches no other module.
 */
const resetDemo: ModuleCli = {
  command: 'reset-demo',
  async run(rest) {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const organizationId = readFlag(rest, 'org')
    const tenantId = readFlag(rest, 'tenant')
    let scopes: Array<{ tenantId: string; organizationId: string }> = []
    if (organizationId && tenantId) {
      scopes = [{ tenantId, organizationId }]
    } else {
      const models = await em.find(PricedModel, {}, { fields: ['tenantId', 'organizationId'] })
      const unique = new Map(models.map((model) => [`${model.tenantId}:${model.organizationId}`, model]))
      scopes = Array.from(unique.values()).map((model) => ({ tenantId: model.tenantId, organizationId: model.organizationId }))
      if (!scopes.length) {
        // Fresh database (module added after init): seed every live organisation.
        const organizations = await em.find(Organization, { deletedAt: null } as never, { populate: [] })
        scopes = organizations.map((organization) => ({
          tenantId: String((organization.tenant as unknown as { id: string }).id ?? organization.tenant),
          organizationId: organization.id,
        }))
      }
    }
    if (!scopes.length) {
      console.error('No organisation with complex_offers data. Pass --org <id> --tenant <id>.')
      return
    }
    for (const scope of scopes) {
      const fork = em.fork()
      await clearComplexOffersData(fork, scope)
      const result = await seedComplexOffersExamples(fork, scope)
      console.log(`[complex_offers] reset ${scope.organizationId}: ${result.models} models, ${result.offers} offers`)
    }
  },
}

export default [resetDemo]
