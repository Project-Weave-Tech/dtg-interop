// Builds site/dist/data.json for the board from goals.json, basics.json,
// ceremonies.json, runs.json, threads.json, credential-profiles.json and
// projects/*/project.json (with trust-tasks.json), plus what GitHub reports:
// licence and last push of every project repository, this repository's own
// issues (shown among the threads) and activity on every thread. GitHub is the
// database; data.json is a view. Without network access the snapshot is used.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const folders = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name).sort()
const repoUrl = process.env.REPO_URL ?? 'https://github.com/Project-Weave-Tech/dtg-interop'
const [owner, repo] = new URL(repoUrl).pathname.slice(1).split('/')
const token = process.env.GITHUB_TOKEN
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dtg-interop-build', ...(token ? { authorization: `Bearer ${token}` } : {}) }
const gh = async (path) => { const r = await fetch(`https://api.github.com${path}`, { headers }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json() }

const basicsFile = read('basics.json')
const goalsFile = read('goals.json')
const runsFile = read('runs.json')
const edit = (p) => `${repoUrl}/edit/main/${p}`
const projects = folders('projects').map((slug) => ({ ...read(`projects/${slug}/project.json`), readme: `${repoUrl}/blob/main/projects/${slug}/README.md`, editUrl: edit(`projects/${slug}/project.json`) }))
const threads = read('threads.json').map((t) => ({ ...t, host: new URL(t.url).hostname + '/' + new URL(t.url).pathname.split('/')[1] }))

const snapshotFile = join(root, 'site/github-snapshot.json')
const snapshot = existsSync(snapshotFile) ? read('site/github-snapshot.json') : { issues: [], repos: {} }
let issues = snapshot.issues, repos = { ...snapshot.repos }, githubFetched = false
let issuesOk = false, reposOk = false, fetchedRepos = 0, failedRepos = 0
const goodRepos = Object.fromEntries(Object.entries(snapshot.repos).filter(([, r]) => !r.error))
try {
  issues = (await gh(`/repos/${owner}/${repo}/issues?state=all&per_page=100`)).filter((i) => !i.pull_request).map((i) => ({
    id: `issue-${i.number}`, number: i.number, title: i.title, url: i.html_url, host: `github.com/${owner}`, state: i.state === 'closed' ? 'decided' : 'open',
    context: (i.body ?? '').split('\n').find((l) => l.trim()) ?? '', labels: i.labels.map((l) => l.name),
    scenarios: i.labels.map((l) => l.name).filter((n) => n.startsWith('scenario:') || n.startsWith('point:')).map((n) => n.slice(n.indexOf(':') + 1)), updated: i.updated_at.slice(0, 10), comments: i.comments }))
  issuesOk = true
} catch (e) { console.warn(`issues not fetched (${e.message}); using the snapshot`) }
try {
  for (const p of projects) for (const url of p.repositories ?? []) {
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/)
    if (!m) continue
    try {
      const r = await gh(`/repos/${m[1]}/${m[2]}`)
      repos[url] = goodRepos[url] = { name: r.full_name, licence: r.license?.spdx_id ?? null, pushedAt: r.pushed_at?.slice(0, 10) ?? null }
      fetchedRepos++
    } catch (e) {
      // keep the last good entry, marked stale; an error never replaces it
      const last = snapshot.repos[url]
      repos[url] = last && !last.error ? { ...last, stale: true } : { error: e.message }
      failedRepos++
    }
  }
  reposOk = failedRepos === 0
} catch (e) { console.warn(`repositories not fetched (${e.message}); using the snapshot`) }
if (failedRepos) console.warn(`${failedRepos} repositor${failedRepos === 1 ? 'y' : 'ies'} not fetched; their last snapshot entries are kept as stale`)
githubFetched = issuesOk && reposOk
// the snapshot only ever takes successful fetches
// Thread activity: for every thread on GitHub (issue, pull request or
// discussion), the number of comments, the date of the last comment and the
// state, read through GraphQL (which needs a token; without one the last
// snapshot is kept). Discussions count top-level comments plus their replies.
const activity = { ...(snapshot.activity ?? {}) }
let activityOk = false
if (token) {
  const gql = async (query, variables) => {
    const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
    const j = await r.json(); if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors ?? r.status)); return j.data
  }
  const ISSUE = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issueOrPullRequest(number:$n){
    ... on Issue{state createdAt updatedAt comments(last:1){totalCount nodes{createdAt}}}
    ... on PullRequest{state createdAt updatedAt comments(last:1){totalCount nodes{createdAt}}}}}}`
  const DISC = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){discussion(number:$n){closed createdAt updatedAt
    comments(last:20){totalCount nodes{createdAt replies(last:1){totalCount nodes{createdAt}}}}}}}`
  const urls = [...threads.map((t) => t.url), ...issues.map((i) => i.url)]
  let failed = 0
  for (const url of urls) {
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull|discussions)\/(\d+)/)
    if (!m) continue
    const [, o, r, kind, n] = m
    try {
      if (kind === 'discussions') {
        const d = (await gql(DISC, { o, r, n: +n })).repository.discussion
        const dates = d.comments.nodes.flatMap((c) => [c.createdAt, ...c.replies.nodes.map((x) => x.createdAt)])
        const replies = d.comments.nodes.reduce((k, c) => k + c.replies.totalCount, 0)
        activity[url] = { comments: d.comments.totalCount + replies, lastComment: dates.sort().at(-1)?.slice(0, 10) ?? null, lastActivity: d.updatedAt.slice(0, 10), state: d.closed ? 'closed' : 'open', created: d.createdAt.slice(0, 10) }
      } else {
        const d = (await gql(ISSUE, { o, r, n: +n })).repository.issueOrPullRequest
        activity[url] = { comments: d.comments.totalCount, lastComment: d.comments.nodes[0]?.createdAt.slice(0, 10) ?? null, lastActivity: d.updatedAt.slice(0, 10), state: d.state.toLowerCase(), created: d.createdAt.slice(0, 10) }
      }
    } catch (e) { failed++; console.warn(`activity not fetched for ${url}: ${String(e.message).slice(0, 200)}`); if (activity[url]) activity[url].stale = true }
  }
  activityOk = failed === 0
  if (failed) console.warn(`${failed} thread(s) without fresh activity; the last snapshot is kept`)
} else console.warn('no GITHUB_TOKEN: thread activity from the snapshot')
if (issuesOk || fetchedRepos || activityOk) writeFileSync(snapshotFile, JSON.stringify({ fetched: new Date().toISOString(), issues: issuesOk ? issues : snapshot.issues, repos: goodRepos, activity }, null, 2) + '\n')


// Derived basic statuses: where a basic names derivedFrom and a project said no
// more than stated there, a matching detail entry with status runs makes the
// basic runs, marked derived, with the entry's evidence. Projects that said
// spec, open, vectors or n/a themselves are left alone.
const matches = (entry, match) => Object.entries(match).every(([k, accepted]) => {
  const v = entry[k]
  return Array.isArray(v) ? v.some((x) => accepted.includes(x)) : accepted.includes(v)
})
for (const pt of basicsFile.basics) {
  if (!pt.derivedFrom) continue
  const { field, match } = pt.derivedFrom
  for (const p of projects) {
    const cell = p.basics?.[pt.id]
    if (cell && cell.status !== 'stated') continue
    const entries = Array.isArray(p[field]) ? p[field] : p[field] ? [p[field]] : []
    const hit = entries.find((e) => e.status === 'runs' && matches(e, match))
    if (!hit) continue
    ;(p.basics ??= {})[pt.id] = { ...(cell ?? {}), status: 'runs', derived: { from: field, said: cell?.status ?? null }, evidence: hit.evidence ?? cell?.evidence ?? [] }
  }
}

// Runs: each run tests one or more subjects (a credential profile, a Trust
// Task type, a ceremony or a basic) between two projects. Pairs and shown
// derive from runs and from nothing else; project statuses never add up to a
// run. A run neither side entered carries reportedBy and is flagged reported.
const cerFile = read('ceremonies.json')
const profiles = read('credential-profiles.json').profiles
const titleOf = (kind, id) => kind === 'credential' ? (profiles[id]?.name ? `${id} (${profiles[id].name})` : id)
  : kind === 'ceremony' ? (cerFile.ceremonies.find((c) => c.id === id)?.title ?? id)
  : kind === 'basic' ? (basicsFile.basics.find((b) => b.id === id)?.title ?? id) : id
const keyOf = (s) => `${s.kind}:${s.id}`
const runs = runsFile.runs.map((r, i) => ({ ...r, index: i, source: r.source || 'manual', subjects: r.subjects.map((x) => ({ ...x, key: keyOf(x), title: titleOf(x.kind, x.id), outcome: x.outcome ?? r.outcome })) }))
  .sort((x, y) => x.date.localeCompare(y.date))
const pairs = {}, shown = {}
for (const r of runs) {
  const key = [r.sides[0].project, r.sides[1].project].sort().join('|')
  for (const sub of r.subjects) {
    ;(pairs[key] ??= []).push({ subject: sub.key, kind: sub.kind, id: sub.id, title: sub.title, date: r.date, outcome: sub.outcome, source: r.source, run: r.index, ...(r.reportedBy ? { reported: true } : {}) })
    if (sub.outcome === 'pass') ((shown[key] ??= {})[sub.key] ??= []).push({ date: r.date, run: r.index, ...(r.reportedBy ? { reported: true } : {}) })
  }
}
const runsOf = (kind, id) => runs.filter((r) => r.subjects.some((x) => x.kind === kind && x.id === id)).map((r) => r.index)
const basics = basicsFile.basics.map((b) => ({ ...b, runs: runsOf('basic', b.id) }))
// Ceremonies: the catalogue joined with who implements each one (from the
// project rows) and the runs that tested it.
const ceremonies = cerFile.ceremonies.map((c) => ({
  ...c,
  implementations: projects.flatMap((p) => (p.ceremonies ?? []).filter((x) => x.ceremony === c.id).map((x) => ({ project: p.slug, ...x }))),
  runs: runsOf('ceremony', c.id),
}))
const map = { layers: basicsFile.layers, statusWords: basicsFile.statusWords }
// Trust Tasks: every project's types resolved (inline or from trust-tasks.json),
// then for each type who uses it, and for each pair of projects what they share.
// An own type mapped to a registry type counts for that registry type too (via).
const REGISTRY = 'https://trusttasks.org/spec/'
const covers = (a, b) => a === b || (a.endsWith('/*') && b.startsWith(a.slice(0, -1)))
const users = new Map()
for (const p of projects) {
  const u = p.trustTaskUse
  if (!u) continue
  const fileTypes = u.typesFile ? read(`projects/${p.slug}/${u.typesFile}`) : null
  const types = [...(u.types ?? []), ...(fileTypes?.types ?? [])].map((t) => (typeof t === 'string' ? { type: t, status: u.status } : t))
  p.trustTaskUse = { ...u, types, ...(fileTypes ? { typesSource: { extracted: fileTypes.extracted, method: fileTypes.method, sources: fileTypes.sources } } : {}) }
  const add = (type, use) => { const list = users.get(type) ?? []; list.push(use); users.set(type, list) }
  for (const t of types) {
    add(t.type, { project: p.slug, status: t.status })
    if (u.mapsTo?.[t.type]) add(u.mapsTo[t.type], { project: p.slug, status: t.status, via: t.type })
  }
  p.trustTaskUse.summary = { registry: types.filter((t) => t.type.startsWith(REGISTRY)).length, own: types.filter((t) => !t.type.startsWith(REGISTRY)).length, ...(u.count ? { count: u.count } : {}) }
}
const ttTypes = [...users].map(([type, list]) => ({ type, registry: type.startsWith(REGISTRY), family: type.startsWith(REGISTRY) ? type.slice(REGISTRY.length).split('/')[0] : null, users: list }))
// a family wildcard (x/*) of one project meets the exact types of another
for (const w of ttTypes.filter((t) => t.type.endsWith('/*'))) for (const t of ttTypes) if (t !== w && covers(w.type, t.type)) for (const u of w.users) if (!t.users.some((x) => x.project === u.project)) t.users.push({ ...u, via: w.type })
ttTypes.sort((a, b) => b.users.length - a.users.length || a.type.localeCompare(b.type))
// shared: both use the type directly; sharedVia: at least one only through mapsTo or a family
const ttShared = {}, ttSharedVia = {}
for (const t of ttTypes) {
  const slugs = [...new Set(t.users.map((u) => u.project))].sort()
  const direct = (s) => t.users.some((u) => u.project === s && !u.via)
  for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) ((direct(slugs[i]) && direct(slugs[j]) ? ttShared : ttSharedVia)[`${slugs[i]}|${slugs[j]}`] ??= []).push(t.type)
}
const trustTasks = { registry: REGISTRY, types: ttTypes, shared: ttShared, sharedVia: ttSharedVia }

// Goals: each need resolved to who brings it (from the project rows) and the
// runs that tested it, so the board can show how far a goal is without
// recomputing the joins.
const bringersOf = (kind, id) => {
  if (kind === 'credentials') return projects.flatMap((p) => (p.credentials ?? []).filter((c) => (c.profiles ?? []).includes(id)).map((c) => ({ project: p.slug, status: c.status })))
  if (kind === 'ceremonies') return projects.flatMap((p) => (p.ceremonies ?? []).filter((c) => c.ceremony === id).map((c) => ({ project: p.slug, status: c.status })))
  if (kind === 'basics') return projects.filter((p) => p.basics?.[id]).map((p) => ({ project: p.slug, status: p.basics[id].status }))
  if (kind === 'tasks') return (ttTypes.find((t) => t.type === id)?.users ?? []).map((u) => ({ project: u.project, status: u.status }))
  return []
}
const partOf = (it, role, group) => ({ kind: it.kind, id: it.id, title: titleOf(it.kind, it.id), role, ...(group != null ? { group } : {}), bringers: bringersOf(it.kind + 's', it.id), runs: runsOf(it.kind, it.id) })
// needs: each entry a single part or a group (oneOf: one is enough); extras do
// not count towards the goal. parts flattens all three for simple views, with
// role required / alternative (with its group index) / extra.
const goals = goalsFile.goals.map((g) => {
  const needs = g.needs.map((n, i) => n.oneOf ? { oneOf: n.oneOf.map((it) => partOf(it, 'alternative', i)) } : partOf(n, 'required'))
  const extras = (g.extras ?? []).map((it) => partOf(it, 'extra'))
  return { ...g, needs, extras, parts: [...needs.flatMap((n) => n.oneOf ?? [n]), ...extras] }
})

// Credentials: the profile catalogue and the closed vocabularies, so the board builds its filters from data
const credSchema = read('schema/project.schema.json').properties.credentials.items.properties
const credentialProfiles = read('credential-profiles.json')
const lane = (k) => read('schema/project.schema.json').properties[k].items.properties
const laneVocabulary = { messaging: lane('messaging').protocol.enum, replication: lane('replication').protocol.enum, via: lane('messaging').via.enum }
const credentialVocabulary = { models: credSchema.model.enum, proofs: credSchema.proof.items.enum, documentProofs: read('schema/project.schema.json').properties.trustTaskUse.properties.documentProof.items.enum }

const data = { generated: new Date().toISOString().slice(0, 10), repo: repoUrl, githubFetched, map, projects, goals, basics, ceremonies, runs, pairs, shown, trustTasks, credentialProfiles, credentialVocabulary, laneVocabulary, threads: [...threads, ...issues].map((t) => (activity[t.url] ? { ...t, activity: activity[t.url] } : t)), repos }
const out = join(root, 'site/dist'); mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'data.json'), JSON.stringify(data, null, 2) + '\n')
for (const f of readdirSync(join(root, 'site'))) if (/\.(html|js|css|svg|png)$/.test(f)) cpSync(join(root, 'site', f), join(out, f))
console.log(`built site/dist: ${projects.length} project(s), ${goals.length} goal(s), ${basics.length} basic(s), ${ceremonies.length} ceremonies, ${runs.length} run(s), ${threads.length} thread(s) + ${issues.length} issue(s)${githubFetched ? '' : ' (snapshot)'}`)
