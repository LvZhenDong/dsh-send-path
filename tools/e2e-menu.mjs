// E2E: Explorer context-menu bridge. Open the real DSH GUI, POST an absolute
// path to the drop-resolver /insert endpoint (exactly what the right-click
// menu's VBS does), and verify the path lands in the composer via SSE.
// Usage: node e2e-menu.mjs <filePath> [debugPort]
import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FILE = process.argv[2]
if (!FILE) { console.error('usage: node e2e-menu.mjs <filePath> [port]'); process.exit(2) }
const PORT = Number(process.argv[3] ?? 9241)
const absPath = path.resolve(FILE)
if (!statSync(FILE).isFile()) { console.error('not a file:', FILE); process.exit(2) }

const profile = path.join(os.tmpdir(), 'dsh-e2e-menu-' + Date.now())
const edge = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-first-run', 'http://127.0.0.1:3080'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))

let page
for (let i = 0; i < 40; i++) {
  try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl); if (page) break } catch { }
  await sleep(250)
}
if (!page) { console.error('no CDP target'); edge.kill(); process.exit(3) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) } }
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })) })
const evalJS = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.value }
const waitFor = async (expr, label, timeoutMs = 45000) => {
  const t0 = Date.now(); let last
  while (Date.now() - t0 < timeoutMs) { try { last = await evalJS(expr); if (last) return last } catch (e) { last = String(e) } await sleep(400) }
  throw new Error('timeout: ' + label + ' last=' + JSON.stringify(last))
}
await send('Runtime.enable')
await waitFor(`!!document.querySelector('textarea[data-phase]')`, 'composer')

// Give the page's EventSource a moment to connect, then POST like the VBS does.
await sleep(1500)
const body = JSON.stringify({ path: absPath })
const resp = await fetch('http://127.0.0.1:3081/insert', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
console.log('insert status:', resp.status, await resp.text())

await sleep(1500)
const value = await evalJS(`document.querySelector('textarea[data-phase]').value`)
console.log('composer value:', JSON.stringify(value))
const ok = typeof value === 'string' && value.trim() === absPath
console.log(ok ? 'E2E MENU PASS' : 'E2E MENU FAIL')
ws.close(); edge.kill(); process.exit(ok ? 0 : 1)
