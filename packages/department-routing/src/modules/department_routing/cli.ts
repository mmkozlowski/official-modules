import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { Department } from './data/entities'
import { resetDepartmentRoutingDemo } from './lib/demo-seed'

function readFlag(argv: string[], name: string): string | null {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] ?? null : null
}

/**
 * `yarn mercato department_routing reset-demo [--org <uuid>]`
 *
 * Restores the example workshop before a recording: wipes this module's data
 * in every organisation that has it (or only in `--org`) and seeds it again
 * with due dates relative to today. Never touches another module's tables.
 */
const resetDemo: ModuleCli = {
  command: 'reset-demo',
  async run(argv) {
    const onlyOrg = readFlag(argv, 'org')
    const { resolve } = await createRequestContainer()
    const em = (resolve('em') as EntityManager).fork()
    const departments = await em.find(Department, onlyOrg ? { organizationId: onlyOrg } : {}, {
      fields: ['tenantId', 'organizationId'],
    })
    const scopes = new Map<string, { tenantId: string; organizationId: string }>()
    for (const department of departments) {
      scopes.set(department.organizationId, { tenantId: department.tenantId, organizationId: department.organizationId })
    }
    if (!scopes.size) {
      console.error('No organisation with department routing data found. Run `yarn mercato init` with examples first.')
      process.exitCode = 1
      return
    }
    for (const scope of scopes.values()) {
      await resetDepartmentRoutingDemo(em.fork(), scope)
      console.log(`department_routing: demo data restored in organisation ${scope.organizationId}`)
    }
  },
}

export default [resetDemo]
