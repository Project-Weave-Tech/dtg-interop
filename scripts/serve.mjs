// Serves site/dist on http://localhost:8787 for a local look at the dashboard.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const dist = new URL('../site/dist/', import.meta.url).pathname
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' }
createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  const file = join(dist, path)
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(8787, () => console.log('http://localhost:8787'))
