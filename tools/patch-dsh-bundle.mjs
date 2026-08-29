#!/usr/bin/env node
/**
 * patch-dsh-bundle.mjs — inject the dsh-send-path insert channel into the DSH
 * web UI's ui-attachment client bundle, so paths pushed by the Explorer
 * context-menu bridge land in the open Harness dialog.
 *
 * Safe for other people's machines:
 *   - Idempotent: skips when the marker (`window.__dshDropPathSource`) exists.
 *   - Tolerant: locates the bundle across common DSH install layouts, or take
 *     `--bundle <path>` to point at it directly.
 *   - Backs up the pristine bundle to `client.js.dsh-send-path.bak` on first
 *     patch (restored by uninstall).
 *   - Anchors on stable region markers; a missing anchor reports clearly
 *     instead of corrupting the bundle.
 *
 * After patching, DSH's client-hmr hot-reloads the open page automatically;
 * otherwise a page refresh picks it up.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()
const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')

// Candidate locations for the ui-attachment client bundle. The first match wins.
function candidatePaths() {
  const pkgs = [
    ['npm global install', path.join(appData, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-attachment', 'lib', 'client.js')],
    ['profile node_modules', path.join(home, '.dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-attachment', 'lib', 'client.js')],
    ['web profile node_modules', path.join(home, '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-client-ui-attachment', 'lib', 'client.js')],
    ['user profile node_modules', path.join(home, '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-client-ui-attachment', 'lib', 'client.js')],
  ]
  // De-duplicate by resolved path.
  const seen = new Set()
  return pkgs.filter(([, p]) => {
    const key = path.resolve(p)
    if (seen.has(key)) return false
    seen.add(key)
    return existsSync(p)
  })
}

const MARKER = 'window.__dshDropPathSource'
const ANCHOR_PRIMARY = '//#region lib/types/client/ComposerAttachments.js'
const ANCHOR_FALLBACK = 'function ComposerAttachments('
const BACKUP_SUFFIX = '.dsh-send-path.bak'

// The injected module-level block (2-tab indent, matching the bundle's own
// style inside the plugin factory). References nothing outside itself.
const BLOCK = `\t\t/** dsh-send-path: Explorer context-menu insert channel.
\t\t* Paths pushed by the drop-resolver's /events SSE stream are inserted
\t\t* into the composer. First hello skips the history replay; a reconnect
\t\t* only inserts frames newer than lastSeq. */
\t\tconst RESOLVER_URL = "http://127.0.0.1:3081";
\t\t/** Insert path strings into the composer draft via its paste pipeline. */
\t\tconst insertDroppedPaths = (paths) => {
\t\t\tconst text = paths.filter((path) => path !== "").join("\\n");
\t\t\tif (text === "") return;
\t\t\t// The textarea composer (data-phase) and the Lexical composer
\t\t\t// (data-composer-input) both route text through their paste handlers.
\t\t\tconst editor = document.querySelector('textarea[data-phase], [data-composer-input][contenteditable="true"]');
\t\t\tif (editor === null) return;
\t\t\tif (editor.tagName === "TEXTAREA") {
\t\t\t\tif (editor.readOnly || editor.disabled) return;
\t\t\t} else if (editor.isContentEditable !== true) {
\t\t\t\treturn;
\t\t\t}
\t\t\teditor.focus({ preventScroll: true });
\t\t\tif (editor.tagName === "TEXTAREA") {
\t\t\t\tconst end = editor.value.length;
\t\t\t\teditor.setSelectionRange(end, end);
\t\t\t} else {
\t\t\t\tconst range = document.createRange();
\t\t\t\trange.selectNodeContents(editor);
\t\t\t\trange.collapse(false);
\t\t\t\tconst selection = window.getSelection();
\t\t\t\tselection.removeAllRanges();
\t\t\t\tselection.addRange(range);
\t\t\t}
\t\t\tlet event = null;
\t\t\ttry {
\t\t\t\tconst dataTransfer = new DataTransfer();
\t\t\t\tdataTransfer.setData("text/plain", text);
\t\t\t\tevent = new ClipboardEvent("paste", { clipboardData: dataTransfer, bubbles: true, cancelable: true });
\t\t\t} catch (error) {
\t\t\t\tevent = null;
\t\t\t}
\t\t\tif (event !== null) {
\t\t\t\teditor.dispatchEvent(event);
\t\t\t} else {
\t\t\t\tdocument.execCommand("insertText", false, text);
\t\t\t}
\t\t};
\t\tif (typeof window !== "undefined" && typeof EventSource !== "undefined" && window.${MARKER.slice(8)} === void 0) {
\t\t\tlet lastSeq = 0;
\t\t\tlet initialized = false;
\t\t\twindow.${MARKER.slice(8)} = new EventSource(\`\${RESOLVER_URL}/events\`);
\t\t\twindow.${MARKER.slice(8)}.addEventListener("hello", (event) => {
\t\t\t\ttry {
\t\t\t\t\tconst data = JSON.parse(event.data);
\t\t\t\t\tif (typeof data.seq === "number") {
\t\t\t\t\t\tif (!initialized) { initialized = true; lastSeq = data.seq; }
\t\t\t\t\t}
\t\t\t\t} catch (error) { /* ignore malformed frame */ }
\t\t\t});
\t\t\twindow.${MARKER.slice(8)}.addEventListener("insert", (event) => {
\t\t\t\ttry {
\t\t\t\t\tconst data = JSON.parse(event.data);
\t\t\t\t\tif (data === null || typeof data.seq !== "number" || data.seq <= lastSeq) return;
\t\t\t\t\tif (typeof data.path === "string" && data.path.length > 0) {
\t\t\t\t\t\tlastSeq = data.seq;
\t\t\t\t\t\tinsertDroppedPaths([data.path]);
\t\t\t\t\t}
\t\t\t\t} catch (error) { /* ignore malformed frame */ }
\t\t\t});
\t\t}
\t\t`;

function locateBundle() {
  const argIndex = process.argv.indexOf('--bundle')
  if (argIndex !== -1 && process.argv[argIndex + 1]) {
    const explicit = process.argv[argIndex + 1]
    if (!existsSync(explicit)) {
      console.error(`[dsh-send-path] --bundle path not found: ${explicit}`)
      process.exit(1)
    }
    return { label: 'explicit --bundle', file: explicit }
  }
  const candidates = candidatePaths()
  if (candidates.length === 0) return null
  const [label, file] = candidates[0]
  return { label, file }
}

function main() {
  const restore = process.argv.includes('--restore')
  const located = locateBundle()
  if (located === null) {
    console.error('[dsh-send-path] Could not find the DSH ui-attachment client bundle.')
    console.error('  Install DSH first, then re-run; or pass: node patch-dsh-bundle.mjs --bundle <path/to/client.js>')
    process.exit(2)
  }
  const { label, file } = located
  const backup = file + BACKUP_SUFFIX

  if (restore) {
    if (!existsSync(backup)) {
      console.log(`[dsh-send-path] No backup to restore (${label}): ${file}`)
      return
    }
    try {
      copyFileSync(backup, file)
      rmSync(backup)
    } catch (error) {
      console.error(`[dsh-send-path] Cannot restore the bundle: ${error.message}`)
      process.exit(1)
    }
    console.log(`[dsh-send-path] Bundle restored (${label}): ${file}`)
    return
  }

  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch (error) {
    console.error(`[dsh-send-path] Cannot read ${file}: ${error.message}`)
    process.exit(1)
  }
  if (source.includes(MARKER)) {
    console.log(`[dsh-send-path] Already patched (${label}): ${file}`)
    return
  }
  if (!existsSync(backup)) {
    try { copyFileSync(file, backup) } catch (error) {
      console.error(`[dsh-send-path] Cannot back up the bundle: ${error.message}`)
      process.exit(1)
    }
  }
  const primary = source.indexOf(ANCHOR_PRIMARY)
  const fallback = source.indexOf(ANCHOR_FALLBACK)
  const anchor = primary !== -1 ? ANCHOR_PRIMARY : fallback
  const at = primary !== -1 ? primary : fallback
  if (at === -1) {
    console.error('[dsh-send-path] Bundle anchors not found; this DSH version may have changed its bundle layout.')
    console.error('  Nothing was modified. Please open an issue with your DSH version.')
    process.exit(1)
  }
  const next = source.slice(0, at) + BLOCK + source.slice(at)
  try {
    writeFileSync(file, next)
  } catch (error) {
    console.error(`[dsh-send-path] Cannot write ${file}: ${error.message}`)
    process.exit(1)
  }
  console.log(`[dsh-send-path] Patched (${label}): ${file}`)
  console.log('  Backup kept at: ' + backup)
  console.log('  The open DSH page hot-reloads automatically (client-hmr); otherwise refresh once.')
}

main()
