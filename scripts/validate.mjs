// Validates scenarios.json, threads.json, projects/*/project.json (with an
// optional projects/*/trust-tasks.json), credential-profiles.json and
// procedures/*/procedure.json against the schemas and checks that every
// scenario id and participant slug exists. Exits 1 with every error.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = new URL('../', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv)
const projectSchema = ajv.compile(read('schema/project.schema.json'))
const procedureSchema = ajv.compile(read('schema/procedure.schema.json'))
const threadSchema = ajv.compile(read('schema/thread.schema.json'))
const trustTasksSchema = ajv.compile(read('schema/trust-tasks.schema.json'))
const profilesSchema = ajv.compile(read('schema/credential-profiles.schema.json'))
const scenariosSchema = ajv.compile(read('schema/scenarios.schema.json'))
const ceremoniesSchema = ajv.compile(read('schema/ceremonies.schema.json'))
const cer = read('ceremonies.json')
const ceremonyIds = new Set(cer.ceremonies.map((c) => c.id))
const catalogue = read('credential-profiles.json')
const map = read('scenarios.json')
const layerIds = new Set(map.layers.map((l) => l.id))
const scenarioIds = new Set(map.scenarios.map((p) => p.id))
const errors = []
if (!scenariosSchema(map)) errors.push(`scenarios.json: ${ajv.errorsText(scenariosSchema.errors, { separator: '\n  ' })}`)
if (!profilesSchema(catalogue)) errors.push(`credential-profiles.json: ${ajv.errorsText(profilesSchema.errors, { separator: '\n  ' })}`)
for (const [id, pr] of Object.entries(catalogue.profiles)) if (!catalogue.families[pr.family]) errors.push(`credential-profiles.json: profile "${id}" names unknown family "${pr.family}"`)
for (const p of map.scenarios) {
  if (!layerIds.has(p.layer)) errors.push(`scenarios.json: scenario "${p.id}" names unknown layer "${p.layer}"`)
}
if (scenarioIds.size !== map.scenarios.length) errors.push('scenarios.json: duplicate scenario id')
const folders = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name)
const projects = new Map()
for (const slug of folders('projects')) {
  const file = `projects/${slug}/project.json`
  if (!existsSync(join(root, file))) { errors.push(`${file}: missing`); continue }
  const row = read(file)
  if (!projectSchema(row)) errors.push(`${file}: ${ajv.errorsText(projectSchema.errors, { separator: '\n  ' })}`)
  if (row.slug !== slug) errors.push(`${file}: slug "${row.slug}" differs from folder "${slug}"`)
  for (const [id, cell] of Object.entries(row.scenarios ?? {})) {
    if (!scenarioIds.has(id)) errors.push(`${file}: unknown scenario "${id}"`)
    if (['runs', 'vectors', 'stated'].includes(cell.status) && !(cell.evidence?.length)) errors.push(`${file}: scenario ${id} is "${cell.status}" without evidence`)
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
for (const slug of folders('procedures')) {
  const file = `procedures/${slug}/procedure.json`
  if (!existsSync(join(root, file))) { errors.push(`${file}: missing`); continue }
  const s = read(file)
  if (!procedureSchema(s)) errors.push(`${file}: ${ajv.errorsText(procedureSchema.errors, { separator: '\n  ' })}`)
  if (s.slug !== slug) errors.push(`${file}: slug "${s.slug}" differs from folder "${slug}"`)
  for (const id of s.scenarios ?? []) if (!scenarioIds.has(id)) errors.push(`${file}: unknown scenario "${id}"`)
  for (const p of s.participants ?? []) if (!projects.has(p)) errors.push(`${file}: participant "${p}" has no projects/${p}/`)
  if (['running', 'passing', 'failing'].includes(s.status) && !(s.results?.length)) errors.push(`${file}: status "${s.status}" without a result`)
  for (const [i, r] of (s.results ?? []).entries()) {
    for (const side of r.sides) if (!projects.has(side.project)) errors.push(`${file}: result names unknown project "${side.project}"`)
    if (r.outcome === 'partial' && !(r.scenarios?.length)) errors.push(`${file}: results[${i}] is "partial" without the scenarios it shows`)
    for (const id of r.scenarios ?? []) if (!(s.scenarios ?? []).includes(id)) errors.push(`${file}: results[${i}] names scenario "${id}" the procedure does not cover`)
  }
  if (!existsSync(join(root, `procedures/${slug}/README.md`))) errors.push(`procedures/${slug}/README.md: missing`)
}
if (!ceremoniesSchema(cer)) errors.push(`ceremonies.json: ${ajv.errorsText(ceremoniesSchema.errors, { separator: '\n  ' })}`)
for (const c of cer.ceremonies) {
  for (const id of c.scenarios ?? []) if (!scenarioIds.has(id)) errors.push(`ceremonies.json: "${c.id}" names unknown scenario "${id}"`)
  for (const pr of c.procedures ?? []) if (!existsSync(join(root, `procedures/${pr}/procedure.json`))) errors.push(`ceremonies.json: "${c.id}" names unknown procedure "${pr}"`)
  if (c.home === 'project' && !projects.has(c.definedBy)) errors.push(`ceremonies.json: "${c.id}" is defined by unknown project "${c.definedBy}"`)
}
for (const [slug, row] of projects) for (const [i, c] of (row.ceremonies ?? []).entries()) {
  if (!ceremonyIds.has(c.ceremony)) errors.push(`projects/${slug}/project.json: ceremonies[${i}] names unknown ceremony "${c.ceremony}"`)
  if (['runs', 'stated'].includes(c.status) && !(c.evidence?.length)) errors.push(`projects/${slug}/project.json: ceremonies[${i}] is "${c.status}" without evidence`)
}
const threads = read('threads.json')
if (!threadSchema(threads)) errors.push(`threads.json: ${ajv.errorsText(threadSchema.errors, { separator: '\n  ' })}`)
for (const t of threads) for (const id of t.scenarios) if (!scenarioIds.has(id)) errors.push(`threads.json: "${t.id}" names unknown scenario "${id}"`)
if (new Set(threads.map((t) => t.id)).size !== threads.length) errors.push('threads.json: duplicate id')
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`valid: ${projects.size} project(s), ${scenarioIds.size} scenario(s), ${folders('procedures').length} procedure(s), ${threads.length} thread(s)`)
