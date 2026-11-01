// Validates points.json, threads.json, projects/*/project.json (with an
// optional projects/*/trust-tasks.json), credential-profiles.json and
// scenarios/*/scenario.json against the schemas and checks that every point id
// and participant slug exists. Exits 1 with every error.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = new URL('../', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv)
const projectSchema = ajv.compile(read('schema/project.schema.json'))
const scenarioSchema = ajv.compile(read('schema/scenario.schema.json'))
const threadSchema = ajv.compile(read('schema/thread.schema.json'))
const trustTasksSchema = ajv.compile(read('schema/trust-tasks.schema.json'))
const profilesSchema = ajv.compile(read('schema/credential-profiles.schema.json'))
const pointsSchema = ajv.compile(read('schema/points.schema.json'))
const catalogue = read('credential-profiles.json')
const map = read('points.json')
const layerIds = new Set(map.layers.map((l) => l.id))
const pointIds = new Set(map.points.map((p) => p.id))
const errors = []
if (!pointsSchema(map)) errors.push(`points.json: ${ajv.errorsText(pointsSchema.errors, { separator: '\n  ' })}`)
if (!profilesSchema(catalogue)) errors.push(`credential-profiles.json: ${ajv.errorsText(profilesSchema.errors, { separator: '\n  ' })}`)
for (const [id, pr] of Object.entries(catalogue.profiles)) if (!catalogue.families[pr.family]) errors.push(`credential-profiles.json: profile "${id}" names unknown family "${pr.family}"`)
for (const p of map.points) {
  if (!layerIds.has(p.layer)) errors.push(`points.json: point "${p.id}" names unknown layer "${p.layer}"`)
  if (p.status === 'proposed' && !p.proposedBy) errors.push(`points.json: proposed point "${p.id}" without proposedBy`)
}
if (pointIds.size !== map.points.length) errors.push('points.json: duplicate point id')
const folders = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name)
const projects = new Map()
for (const slug of folders('projects')) {
  const file = `projects/${slug}/project.json`
  if (!existsSync(join(root, file))) { errors.push(`${file}: missing`); continue }
  const row = read(file)
  if (!projectSchema(row)) errors.push(`${file}: ${ajv.errorsText(projectSchema.errors, { separator: '\n  ' })}`)
  if (row.slug !== slug) errors.push(`${file}: slug "${row.slug}" differs from folder "${slug}"`)
  for (const [id, cell] of Object.entries(row.points ?? {})) {
    if (!pointIds.has(id)) errors.push(`${file}: unknown point "${id}"`)
    if (['runs', 'vectors'].includes(cell.status) && !(cell.evidence?.length)) errors.push(`${file}: point ${id} is "${cell.status}" without evidence`)
  }
  if (!existsSync(join(root, `projects/${slug}/README.md`))) errors.push(`projects/${slug}/README.md: missing`)
  const tt = `projects/${slug}/trust-tasks.json`
  if (row.trustTaskUse?.typesFile && !existsSync(join(root, tt))) errors.push(`${tt}: named in trustTaskUse.typesFile but missing`)
  if (existsSync(join(root, tt)) && !trustTasksSchema(read(tt))) errors.push(`${tt}: ${ajv.errorsText(trustTasksSchema.errors, { separator: '\n  ' })}`)
  if (row.trustTaskUse?.status === 'runs' && !(row.trustTaskUse.evidence?.length)) errors.push(`${file}: trustTaskUse is "runs" without evidence`)
  for (const [k, vals] of Object.entries(row.facets ?? {})) for (const v of vals) if (typeof v === 'object' && v.status === 'runs' && !(v.evidence?.length)) errors.push(`${file}: facets.${k} "${v.value}" is "runs" without evidence`)
  for (const lane of ['messaging', 'replication']) for (const [i, e] of (row[lane] ?? []).entries()) if (e.status === 'runs' && !(e.evidence?.length)) errors.push(`${file}: ${lane}[${i}] is "runs" without evidence`)
  for (const [i, c] of (row.credentials ?? []).entries()) {
    if (c.status === 'runs' && !(c.evidence?.length)) errors.push(`${file}: credentials[${i}] is "runs" without evidence`)
    for (const pr of c.profiles ?? []) if (!catalogue.profiles[pr]) errors.push(`${file}: credentials[${i}] names unknown profile "${pr}" (add it to credential-profiles.json)`)
  }
  projects.set(slug, row)
}
for (const slug of folders('scenarios')) {
  const file = `scenarios/${slug}/scenario.json`
  if (!existsSync(join(root, file))) { errors.push(`${file}: missing`); continue }
  const s = read(file)
  if (!scenarioSchema(s)) errors.push(`${file}: ${ajv.errorsText(scenarioSchema.errors, { separator: '\n  ' })}`)
  if (s.slug !== slug) errors.push(`${file}: slug "${s.slug}" differs from folder "${slug}"`)
  for (const id of s.points ?? []) if (!pointIds.has(id)) errors.push(`${file}: unknown point "${id}"`)
  for (const p of s.participants ?? []) if (!projects.has(p)) errors.push(`${file}: participant "${p}" has no projects/${p}/`)
  if (['running', 'passing', 'failing'].includes(s.status) && !(s.results?.length)) errors.push(`${file}: status "${s.status}" without a result`)
  for (const [i, r] of (s.results ?? []).entries()) {
    for (const side of r.sides) if (!projects.has(side.project)) errors.push(`${file}: result names unknown project "${side.project}"`)
    if (r.outcome === 'partial' && !(r.points?.length)) errors.push(`${file}: results[${i}] is "partial" without the points it shows`)
    for (const id of r.points ?? []) if (!(s.points ?? []).includes(id)) errors.push(`${file}: results[${i}] names point "${id}" the scenario does not cover`)
  }
  if (!existsSync(join(root, `scenarios/${slug}/README.md`))) errors.push(`scenarios/${slug}/README.md: missing`)
}
const threads = read('threads.json')
if (!threadSchema(threads)) errors.push(`threads.json: ${ajv.errorsText(threadSchema.errors, { separator: '\n  ' })}`)
for (const t of threads) for (const id of t.points) if (!pointIds.has(id)) errors.push(`threads.json: "${t.id}" names unknown point "${id}"`)
if (new Set(threads.map((t) => t.id)).size !== threads.length) errors.push('threads.json: duplicate id')
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`valid: ${projects.size} project(s), ${folders('scenarios').length} scenario(s), ${pointIds.size} point(s), ${threads.length} thread(s)`)
