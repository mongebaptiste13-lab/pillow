/**
 * Mini-Supabase en mémoire, juste assez fidèle pour tester le dispatcher :
 * from / select / insert / upsert / update / delete + filtres eq, neq, is, in, gte, lte, or.
 * Sémantique SQL respectée là où ça compte : `neq` sur NULL est faux (donc le `is.null` du `or`).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../lib/database.types"

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>
type Predicate = (row: Row) => boolean

const PRIMARY: Record<string, string> = {
  profiles: "id",
  pill_logs: "user_id,date",
  push_subscriptions: "endpoint",
  notification_schedules: "id",
  notification_state: "user_id",
}

function compare(a: string, b: string): number {
  if (a.includes("T") && b.includes("T")) return Date.parse(a) - Date.parse(b)
  return a < b ? -1 : a > b ? 1 : 0
}

class Query implements PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  private filters: Predicate[] = []
  private mode: "select" | "update" | "delete" | "upsert" | "insert" = "select"
  private values: Row | Row[] = {}
  private returning = false
  private limitN = Infinity
  private orderBy: { col: string; asc: boolean } | null = null
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}

  constructor(private tables: Tables, private table: string) {}

  select() { this.returning = true; return this }
  insert(v: Row | Row[]) { this.mode = "insert"; this.values = v; return this }
  upsert(v: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.mode = "upsert"; this.values = v; this.upsertOpts = opts; return this }
  update(v: Row) { this.mode = "update"; this.values = v; return this }
  delete() { this.mode = "delete"; return this }

  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] != null && r[col] !== val); return this }
  is(col: string, val: null) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this }
  // Comparaison « SQL » : les horodatages se comparent comme des instants, pas comme du texte
  gte(col: string, val: string) { this.filters.push((r) => r[col] != null && compare(String(r[col]), val) >= 0); return this }
  lte(col: string, val: string) { this.filters.push((r) => r[col] != null && compare(String(r[col]), val) <= 0); return this }
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".")
      const val = rest.join(".")
      return (r: Row) => {
        if (op === "is" && val === "null") return r[col] == null
        if (op === "neq") return r[col] != null && r[col] !== val
        if (op === "eq") return r[col] === val
        throw new Error(`fake or(): opérateur non géré ${p}`)
      }
    })
    this.filters.push((r) => parts.some((f) => f(r)))
    return this
  }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limitN = n; return this }

  private matches(r: Row) { return this.filters.every((f) => f(r)) }
  private keyOf(r: Row, cols: string) { return cols.split(",").map((c) => String(r[c])).join("|") }

  private run() {
    const rows = (this.tables[this.table] ??= [])
    const pk = this.upsertOpts.onConflict ?? PRIMARY[this.table]

    if (this.mode === "insert" || this.mode === "upsert") {
      const list = Array.isArray(this.values) ? this.values : [this.values]
      const out: Row[] = []
      for (const v of list) {
        const existing = rows.find((r) => this.keyOf(r, pk) === this.keyOf(v, pk))
        if (existing && this.mode === "upsert") {
          if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, v)
          out.push(existing)
        } else if (!existing) {
          const created = { id: `gen-${rows.length + 1}`, ...v }
          rows.push(created)
          out.push(created)
        }
      }
      return out
    }
    if (this.mode === "update") {
      const hit = rows.filter((r) => this.matches(r))
      hit.forEach((r) => Object.assign(r, this.values))
      return hit
    }
    if (this.mode === "delete") {
      const hit = rows.filter((r) => this.matches(r))
      this.tables[this.table] = rows.filter((r) => !hit.includes(r))
      return hit
    }
    let out = rows.filter((r) => this.matches(r))
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
    }
    return out.slice(0, this.limitN)
  }

  then<T1, T2>(
    onfulfilled?: ((v: { data: Row[] | null; error: { message: string } | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
  ) {
    return Promise.resolve()
      .then(() => {
        const result = this.run().map((r) => ({ ...r }))
        const wantsRows = this.mode === "select" || this.returning
        return { data: wantsRows ? result : null, error: null }
      })
      .then(onfulfilled, onrejected)
  }
}

export function createFakeSupabase(initial: Tables = {}) {
  const tables: Tables = structuredClone(initial)
  const client = { from: (table: string) => new Query(tables, table) } as unknown as SupabaseClient<Database>
  return { client, tables }
}
