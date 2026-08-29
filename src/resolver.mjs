#!/usr/bin/env node
/**
 * dsh drop-resolver: tiny loopback-only bridge for the Explorer context-menu
 * feature. Windows Explorer invokes send-path.vbs with the exact absolute path
 * of the right-clicked file/folder; the VBS POSTs it here, and this service
 * pushes it into the open DeepSeek Harness web dialog:
 *
 *   POST /insert  { path }   (context-menu bridge -> publish to /events)
 *   GET  /events             (SSE insert channel consumed by the web page)
 *   GET  /health  -> { ok: true, pid }
 *
 * Binds 127.0.0.1 only. CORS is restricted to loopback web origins. Pure Node,
 * zero dependencies. No dialogs are ever opened by this service.
 */
import http from 'node:http'
import { appendFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.DSH_RESOLVER_PORT ?? 3081)
const HOST = '127.0.0.1'
const HOME = os.homedir()
const LOG = path.join(HOME, '.dsh', 'drop-resolver', 'resolver.log')
const PID_FILE = path.join(HOME, '.dsh', 'drop-resolver', 'resolver.pid')

function log(line) {
  const stamp = new Date().toISOString()
  try { appendFileSync(LOG, `[${stamp}] ${line}\n`) } catch { /* best effort */ }
}

// --- external path insertion channel (Explorer context-menu bridge) ---
const insertWaiters = new Set()
const insertHistory = [] // recent frames, replayed on SSE reconnect (frontend dedupes by seq)
const INSERT_HISTORY_MAX = 50
let insertSeq = 0

function publishInsert(p) {
  insertSeq += 1
  const frame = { type: 'insert', seq: insertSeq, path: p }
  insertHistory.push(frame)
  if (insertHistory.length > INSERT_HISTORY_MAX) insertHistory.shift()
  const line = `event: insert\ndata: ${JSON.stringify(frame)}\n\n`
  for (const res of insertWaiters) {
    try { res.write(line) } catch { /* socket gone */ }
  }
  log(`insert #${insertSeq} ${p}`)
}

function json(res, status, body, acao) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': acao ?? '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', c => {
      size += c.length
      if (size > limit) { req.destroy(); resolve(null); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  const allow = origin === undefined || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  const acao = allow && origin !== undefined ? origin : '*'
  const setCors = (r) => {
    r.setHeader('access-control-allow-origin', acao)
    r.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    r.setHeader('access-control-allow-headers', 'content-type')
  }
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.writeHead(204)
    res.end()
    return
  }
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)
    if (req.method === 'GET' && url.pathname === '/health') {
      setCors(res)
      json(res, 200, { ok: true, pid: process.pid }, acao)
      return
    }
    if (req.method === 'POST' && url.pathname === '/insert') {
      setCors(res)
      const raw = await readBody(req)
      if (raw === null) { json(res, 400, { error: 'bad body' }, acao); return }
      // Accept {"path": "..."} JSON (with proper escaping) or a bare path body.
      let pathText = ''
      try {
        const parsed = JSON.parse(raw)
        pathText = typeof parsed?.path === 'string' ? parsed.path : ''
      } catch {
        pathText = raw.trim()
      }
      if (!/^[A-Za-z]:[\\/]/.test(pathText)) {
        json(res, 400, { error: 'not an absolute path' }, acao)
        return
      }
      publishInsert(pathText)
      json(res, 200, { ok: true, seq: insertSeq }, acao)
      return
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      setCors(res)
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      })
      res.write(`event: hello\ndata: ${JSON.stringify({ type: 'hello', seq: insertSeq })}\n\n`)
      for (const frame of insertHistory) {
        res.write(`event: insert\ndata: ${JSON.stringify(frame)}\n\n`)
      }
      insertWaiters.add(res)
      const keepAlive = setInterval(() => { try { res.write(': ping\n\n') } catch { /* gone */ } }, 20000)
      req.on('close', () => {
        clearInterval(keepAlive)
        insertWaiters.delete(res)
      })
      return
    }
    setCors(res)
    json(res, 404, { error: 'not found' }, acao)
  } catch (error) {
    log(`error ${String(error)}`)
    try { json(res, 500, { error: String(error) }, acao) } catch { /* socket gone */ }
  }
})

server.on('error', (error) => {
  // Port already in use: an older instance is serving — exit quietly.
  if (error.code === 'EADDRINUSE') {
    log('port in use; exiting (another instance is running)')
    process.exit(0)
  }
  log(`server error ${String(error)}`)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  try { writeFileSync(PID_FILE, String(process.pid)) } catch { /* best effort */ }
  log(`listening on http://${HOST}:${PORT} pid=${process.pid}`)
})
