// Builds site/dist/data.json for the board from scenarios.json, threads.json,
// projects/*/project.json (with trust-tasks.json), credential-profiles.json and
// procedures/*/procedure.json, plus what GitHub
// reports: licence and last push of every project repository, and this
// repository's own issues (shown among the threads). GitHub is the database;
// data.json is a view. Without network access the committed snapshot is used.
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

const catalogue = read('scenarios.json')
const edit = (p) => `${repoUrl}/edit/main/${p}`
const projects = folders('projects').map((slug) => ({ ...read(`projects/${slug}/project.json`), readme: `${repoUrl}/blob/main/projects/${slug}/README.md`, editUrl: edit(`projects/${slug}/project.json`) }))
const procedures = folders('procedures').map((slug) => ({ ...read(`procedures/${slug}/procedure.json`), readme: `${repoUrl}/blob/main/procedures/${slug}/README.md`, editUrl: edit(`procedures/${slug}/procedure.json`) }))
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
    comments(last:50){totalCount nodes{createdAt replies(last:1){totalCount nodes{createdAt}}}}}}}`
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
    } catch (e) { failed++; if (activity[url]) activity[url].stale = true }
  }
  activityOk = failed === 0
  if (failed) console.warn(`${failed} thread(s) without fresh activity; the last snapshot is kept`)
} else console.warn('no GITHUB_TOKEN: thread activity from the snapshot')
if (issuesOk || fetchedRepos || activityOk) writeFileSync(snapshotFile, JSON.stringify({ fetched: new Date().toISOString(), issues: issuesOk ? issues : snapshot.issues, repos: goodRepos, activity }, null, 2) + '\n')


// Derived scenario statuses: where a scenario names derivedFrom and a project said no
// more than stated there, a matching detail entry with status runs makes the
// scenario runs, marked derived, with the entry's evidence. Projects that said
// spec, open, vectors or n/a themselves are left alone.
const matches = (entry, match) => Object.entries(match).every(([k, accepted]) => {
  const v = entry[k]
  return Array.isArray(v) ? v.some((x) => accepted.includes(x)) : accepted.includes(v)
})
for (const pt of catalogue.scenarios) {
  if (!pt.derivedFrom) continue
  const { field, match } = pt.derivedFrom
  for (const p of projects) {
    const cell = p.scenarios?.[pt.id]
    if (cell && cell.status !== 'stated') continue
    const entries = Array.isArray(p[field]) ? p[field] : p[field] ? [p[field]] : []
    const hit = entries.find((e) => e.status === 'runs' && matches(e, match))
    if (!hit) continue
    ;(p.scenarios ??= {})[pt.id] = { ...(cell ?? {}), status: 'runs', derived: { from: field, said: cell?.status ?? null }, evidence: hit.evidence ?? cell?.evidence ?? [] }
  }
}

// Runs: every result of a procedure, attached to each scenario the procedure
// covers. A pass runs every covered scenario; a partial runs the scenarios it
// names (the others count as partial); a fail fails all of them. Pairs and
// shown derive from these runs and from nothing else; project statuses never
// add up to a run. A result neither side entered carries reportedBy and is
// flagged reported.
const outcomeFor = (r, id) => r.outcome === 'partial' ? ((r.scenarios ?? []).includes(id) ? 'pass' : 'partial') : r.outcome
const runsOf = {}
const pairs = {}, shown = {}
for (const pr of procedures) for (const r of pr.results ?? []) {
  const slugs = [...new Set(r.sides.map((x) => x.project))].sort()
  for (const id of pr.scenarios ?? []) {
    const outcome = outcomeFor(r, id)
    ;(runsOf[id] ??= []).push({ ...r, outcome, procedure: pr.slug, source: r.source || 'manual' })
    const sc = catalogue.scenarios.find((x) => x.id === id)
    for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) {
      const key = `${slugs[i]}|${slugs[j]}`
      ;(pairs[key] ??= []).push({ scenario: id, title: sc ? sc.title : id, procedure: pr.slug, date: r.date, outcome, source: r.source || 'manual', ...(r.reportedBy ? { reported: true } : {}) })
      if (outcome === 'pass') ((shown[key] ??= {})[id] ??= []).push({ procedure: pr.slug, date: r.date, ...(r.reportedBy ? { reported: true } : {}) })
    }
  }
}
// Scenarios in the shape the board reads: the catalogue entry, its procedure
// (the first folder covering it; absent = no procedure yet) and its runs.
const scenarios = catalogue.scenarios.map((sc) => {
  const covering = procedures.filter((pr) => (pr.scenarios ?? []).includes(sc.id))
  const pr = covering[0]
  return {
    ...sc,
    ...(pr ? { procedure: { slug: pr.slug, title: pr.title, summary: pr.summary, status: pr.status, readme: pr.readme, editUrl: pr.editUrl, vectors: pr.vectors ?? [], participants: pr.participants ?? [], ...(pr.waitingOn ? { waitingOn: pr.waitingOn } : {}), ...(pr.issue ? { issue: pr.issue } : {}), ...(covering.length > 1 ? { also: covering.slice(1).map((x) => x.slug) } : {}) } } : {}),
    runs: (runsOf[sc.id] ?? []).sort((x, y) => x.date.localeCompare(y.date)),
  }
})
const map = { layers: catalogue.layers, statusWords: catalogue.statusWords, shown: catalogue.shown }
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

// Credentials: the profile catalogue and the closed vocabularies, so the board builds its filters from data
const credSchema = read('schema/project.schema.json').properties.credentials.items.properties
const credentialProfiles = read('credential-profiles.json')
const lane = (k) => read('schema/project.schema.json').properties[k].items.properties
const laneVocabulary = { messaging: lane('messaging').protocol.enum, replication: lane('replication').protocol.enum, via: lane('messaging').via.enum }
const credentialVocabulary = { models: credSchema.model.enum, proofs: credSchema.proof.items.enum, documentProofs: read('schema/project.schema.json').properties.trustTaskUse.properties.documentProof.items.enum }

const data = { generated: new Date().toISOString().slice(0, 10), repo: repoUrl, githubFetched, map, projects, scenarios, procedures, pairs, shown, trustTasks, credentialProfiles, credentialVocabulary, laneVocabulary, threads: [...threads, ...issues].map((t) => (activity[t.url] ? { ...t, activity: activity[t.url] } : t)), repos }
const out = join(root, 'site/dist'); mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'data.json'), JSON.stringify(data, null, 2) + '\n')
for (const f of readdirSync(join(root, 'site'))) if (/\.(html|js|css|svg|png)$/.test(f)) cpSync(join(root, 'site', f), join(out, f))
console.log(`built site/dist: ${projects.length} project(s), ${scenarios.length} scenario(s), ${procedures.length} procedure(s), ${threads.length} thread(s) + ${issues.length} issue(s)${githubFetched ? '' : ' (snapshot)'}`)
