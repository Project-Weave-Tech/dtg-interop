// Builds site/dist/data.json for the board from points.json, threads.json,
// projects/*/project.json and scenarios/*/scenario.json, plus what GitHub
// reports: licence and last push of every project repository, and this
// repository's own issues (shown among the threads). GitHub is the database;
// data.json is a view. Without network access the committed snapshot is used.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const folders = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name).sort()
const repoUrl = process.env.REPO_URL ?? 'https://github.com/real-life-org/dtg-interop'
const [owner, repo] = new URL(repoUrl).pathname.slice(1).split('/')
const token = process.env.GITHUB_TOKEN
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dtg-interop-build', ...(token ? { authorization: `Bearer ${token}` } : {}) }
const gh = async (path) => { const r = await fetch(`https://api.github.com${path}`, { headers }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json() }

const map = read('points.json')
const edit = (p) => `${repoUrl}/edit/main/${p}`
const projects = folders('projects').map((slug) => ({ ...read(`projects/${slug}/project.json`), readme: `${repoUrl}/blob/main/projects/${slug}/README.md`, editUrl: edit(`projects/${slug}/project.json`) }))
const scenarios = folders('scenarios').map((slug) => ({ ...read(`scenarios/${slug}/scenario.json`), readme: `${repoUrl}/blob/main/scenarios/${slug}/README.md`, editUrl: edit(`scenarios/${slug}/scenario.json`) }))
const threads = read('threads.json').map((t) => ({ ...t, host: new URL(t.url).hostname + '/' + new URL(t.url).pathname.split('/')[1] }))

const snapshotFile = join(root, 'site/github-snapshot.json')
const snapshot = existsSync(snapshotFile) ? read('site/github-snapshot.json') : { issues: [], repos: {} }
let issues = snapshot.issues, repos = { ...snapshot.repos }, githubFetched = false
let issuesOk = false, reposOk = false
try {
  issues = (await gh(`/repos/${owner}/${repo}/issues?state=all&per_page=100`)).filter((i) => !i.pull_request).map((i) => ({
    id: `issue-${i.number}`, number: i.number, title: i.title, url: i.html_url, host: `github.com/${owner}`, state: i.state === 'closed' ? 'decided' : 'open',
    context: (i.body ?? '').split('\n').find((l) => l.trim()) ?? '', labels: i.labels.map((l) => l.name),
    points: i.labels.map((l) => l.name).filter((n) => n.startsWith('point:')).map((n) => n.slice(6)), updated: i.updated_at.slice(0, 10), comments: i.comments }))
  issuesOk = true
} catch (e) { console.warn(`issues not fetched (${e.message}); using the snapshot`) }
try {
  for (const p of projects) for (const url of p.repositories ?? []) {
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/)
    if (!m) continue
    try { const r = await gh(`/repos/${m[1]}/${m[2]}`); repos[url] = { name: r.full_name, licence: r.license?.spdx_id ?? null, pushedAt: r.pushed_at?.slice(0, 10) ?? null } } catch (e) { repos[url] = { error: e.message } }
  }
  reposOk = true
} catch (e) { console.warn(`repositories not fetched (${e.message}); using the snapshot`) }
githubFetched = issuesOk && reposOk
if (issuesOk || reposOk) writeFileSync(snapshotFile, JSON.stringify({ fetched: new Date().toISOString(), issues, repos }, null, 2) + '\n')

const pairs = {}
for (const s of scenarios) for (const r of s.results ?? []) {
  const slugs = [...new Set(r.sides.map((x) => x.project))].sort()
  for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) (pairs[`${slugs[i]}|${slugs[j]}`] ??= []).push({ scenario: s.slug, title: s.title, date: r.date, outcome: r.outcome })
}
const data = { generated: new Date().toISOString().slice(0, 10), repo: repoUrl, githubFetched, map, projects, scenarios, pairs, threads: [...threads, ...issues], repos }
const out = join(root, 'site/dist'); mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'data.json'), JSON.stringify(data, null, 2) + '\n')
for (const f of readdirSync(join(root, 'site'))) if (/\.(html|js|css|svg|png)$/.test(f)) cpSync(join(root, 'site', f), join(out, f))
console.log(`built site/dist: ${projects.length} project(s), ${scenarios.length} scenario(s), ${map.points.length} point(s), ${threads.length} thread(s) + ${issues.length} issue(s)${githubFetched ? '' : ' (snapshot)'}`)
