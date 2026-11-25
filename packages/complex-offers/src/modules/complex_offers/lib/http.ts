import { NextResponse } from 'next/server'
import type { z } from 'zod'
import type { OfferVersion } from '../data/entities'

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/** Reads and validates a JSON body; malformed JSON is reported like any other invalid input. */
export async function parseJsonBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<ParsedBody<z.infer<T>>> {
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // Rejected by safeParse below with the usual shape.
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      response: NextResponse.json({ error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path }, { status: 422 }),
    }
  }
  return { ok: true, data: parsed.data }
}

export const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 })

/**
 * The edit lock. Only a draft version accepts changes to its lines; a sent,
 * accepted or rejected one answers 409 `version_locked` — the UI offers "new
 * version" instead. Enforced here, on the server, not only by hiding buttons.
 */
export function lockedResponse(version: OfferVersion): NextResponse | null {
  if (version.status === 'draft') return null
  return NextResponse.json({ error: 'version_locked', status: version.status }, { status: 409 })
}
