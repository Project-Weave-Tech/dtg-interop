// Validates goals.json, basics.json, ceremonies.json, runs.json, threads.json,
// credential-profiles.json and projects/*/project.json (with an optional
// projects/*/trust-tasks.json) against the schemas, and checks that every id a
// file names exists. Exits 1 with every error.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = new URL('../', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv)
const compile = (f) => ajv.compile(read(`schema/${f}.schema.json`))
const S = { project: compile('project'), thread: compile('thread'), trustTasks: compile('trust-tasks'), profiles: compile('credential-profiles'), basics: compile('basics'), goals: compile('goals'), ceremonies: compile('ceremonies'), runs: compile('runs') }
const errors = []
const check = (schema, data, file) => { if (!schema(data)) errors.push(`${file}: ${ajv.errorsText(schema.errors, { separator: '\n  ' })}`) }

const catalogue = read('credential-profiles.json'); check(S.profiles, catalogue, 'credential-profiles.json')
for (const [id, pr] of Object.entries(catalogue.profiles)) if (!catalogue.families[pr.family]) errors.push(`credential-profiles.json: profile "${id}" names unknown family "${pr.family}"`)
const basics = read('basics.json'); check(S.basics, basics, 'basics.json')
const layerIds = new Set(basics.layers.map((l) => l.id))
const basicIds = new Set(basics.basics.map((b) => b.id))
if (basicIds.size !== basics.basics.length) errors.push('basics.json: duplicate id')
for (const b of basics.basics) if (!layerIds.has(b.layer)) errors.push(`basics.json: "${b.id}" names unknown layer "${b.layer}"`)
const cer = read('ceremonies.json'); check(S.ceremonies, cer, 'ceremonies.json')
const ceremonyIds = new Set(cer.ceremonies.map((c) => c.id))
const goals = read('goals.json'); check(S.goals, goals, 'goals.json')
const goalIds = new Set(goals.goals.map((g) => g.id))
const threads = read('threads.json'); check(S.thread, threads, 'threads.json')
const threadIds = new Set(threads.map((t) => t.id))
if (threadIds.size !== threads.length) errors.push('threads.json: duplicate id')

const folders = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name)
const projects = new Map()
const taskTypes = new Set()
for (const slug of folders('projects')) {
  const file = `projects/${slug}/project.json`
  if (!existsSync(join(root, file))) { errors.push(`${file}: missing`); continue }
  const row = read(file)
  check(S.project, row, file)
  if (row.slug !== slug) errors.push(`${file}: slug "${row.slug}" differs from folder "${slug}"`)
  for (const [id, cell] of Object.entries(row.basics ?? {})) {
    if (!basicIds.has(id)) errors.push(`${file}: unknown basic "${id}"`)
    if (['runs', 'vectors', 'stated'].includes(cell.status) && !(cell.evidence?.length)) errors.push(`${file}: basic ${id} is "${cell.status}" without evidence`)
  }
  for (const [i, c] of (row.ceremonies ?? []).entries()) {
    if (!ceremonyIds.has(c.ceremony)) errors.push(`${file}: ceremonies[${i}] names unknown ceremony "${c.ceremony}"`)
    if (['runs', 'stated'].includes(c.status) && !(c.evidence?.length)) errors.push(`${file}: ceremonies[${i}] is "${c.status}" without evidence`)
  }
  if (!existsSync(join(root, `projects/${slug}/README.md`))) errors.push(`projects/${slug}/README.md: missing`)
  const tt = `projects/${slug}/trust-tasks.json`
  if (row.trustTaskUse?.typesFile && !existsSync(join(root, tt))) errors.push(`${tt}: named in trustTaskUse.typesFile but missing`)
  if (existsSync(join(root, tt))) { const f = read(tt); check(S.trustTasks, f, tt); for (const t of f.types ?? []) taskTypes.add(typeof t === 'string' ? t : t.type) }
  for (const t of row.trustTaskUse?.types ?? []) taskTypes.add(typeof t === 'string' ? t : t.type)
  if (row.trustTaskUse?.status === 'runs' && !(row.trustTaskUse.evidence?.length)) errors.push(`${file}: trustTaskUse is "runs" without evidence`)
  for (const [k, vals] of Object.entries(row.facets ?? {})) for (const v of vals) if (typeof v === 'object' && v.status === 'runs' && !(v.evidence?.length)) errors.push(`${file}: facets.${k} "${v.value}" is "runs" without evidence`)
  for (const lane of ['messaging', 'replication']) for (const [i, e] of (row[lane] ?? []).entries()) if (e.status === 'runs' && !(e.evidence?.length)) errors.push(`${file}: ${lane}[${i}] is "runs" without evidence`)
  for (const [i, c] of (row.credentials ?? []).entries()) {
    if (c.status === 'runs' && !(c.evidence?.length)) errors.push(`${file}: credentials[${i}] is "runs" without evidence`)
    for (const pr of c.profiles ?? []) if (!catalogue.profiles[pr]) errors.push(`${file}: credentials[${i}] names unknown profile "${pr}" (add it to credential-profiles.json)`)
  }
  projects.set(slug, row)
}
for (const c of cer.ceremonies) {
  for (const g of c.goals ?? []) if (!goalIds.has(g)) errors.push(`ceremonies.json: "${c.id}" names unknown goal "${g}"`)
  if (c.home === 'project' && !projects.has(c.definedBy)) errors.push(`ceremonies.json: "${c.id}" is defined by unknown project "${c.definedBy}"`)
}
const known = { credentials: (id) => !!catalogue.profiles[id], ceremonies: (id) => ceremonyIds.has(id), basics: (id) => basicIds.has(id), tasks: () => true }
for (const g of goals.goals) {
  for (const [kind, ids] of Object.entries(g.needs)) for (const id of ids) if (!known[kind](id)) errors.push(`goals.json: "${g.id}" needs unknown ${kind.replace(/s$/, '')} "${id}"`)
  for (const m of g.missing ?? []) if (m.thread && !threadIds.has(m.thread)) errors.push(`goals.json: "${g.id}" names unknown thread "${m.thread}"`)
}
const subjectKnown = { credential: (id) => !!catalogue.profiles[id], ceremony: (id) => ceremonyIds.has(id), basic: (id) => basicIds.has(id), task: () => true }
const runs = read('runs.json'); check(S.runs, runs, 'runs.json')
for (const [i, r] of runs.runs.entries()) {
  for (const s of r.subjects) if (!subjectKnown[s.kind](s.id)) errors.push(`runs.json: runs[${i}] tests unknown ${s.kind} "${s.id}"`)
  for (const side of r.sides) if (!projects.has(side.project)) errors.push(`runs.json: runs[${i}] names unknown project "${side.project}"`)
  if (r.sides[0].project === r.sides[1].project) errors.push(`runs.json: runs[${i}] has the same project on both sides`)
  if (r.reportedBy && !projects.has(r.reportedBy.project)) errors.push(`runs.json: runs[${i}] reportedBy names unknown project "${r.reportedBy.project}"`)
}
const anyId = (id) => goalIds.has(id) || basicIds.has(id) || ceremonyIds.has(id)
for (const t of threads) for (const id of t.about) if (!anyId(id)) errors.push(`threads.json: "${t.id}" is about unknown "${id}"`)
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`valid: ${projects.size} project(s), ${goalIds.size} goal(s), ${basicIds.size} basic(s), ${ceremonyIds.size} ceremonies, ${runs.runs.length} run(s), ${threads.length} thread(s)`)
