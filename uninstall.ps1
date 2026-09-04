# dsh-send-path uninstaller — removes the menu entries, the autostart entry,
# stops the resolver, and restores the original DSH bundle.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'
$tools = Join-Path $root 'tools'

Write-Host 'Uninstalling dsh-send-path...' -ForegroundColor Cyan

# 1) Context menu entries.
foreach ($base in @(
  'HKCU:\Software\Classes\*\shell\DSHSendPath',
  'HKCU:\Software\Classes\Directory\shell\DSHSendPath'
)) {
  if (Test-Path $base) { Remove-Item -LiteralPath $base -Recurse -Force }
}

# 2) Autostart entry.
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if (Test-Path (Join-Path $runKey 'dsh-send-path')) { Remove-ItemProperty -LiteralPath $runKey -Name 'dsh-send-path' }

# 3) Stop the resolver.
$pidFile = Join-Path (Join-Path $env:USERPROFILE '.dsh') 'drop-resolver\resolver.pid'
if (Test-Path $pidFile) {
  $pidText = (Get-Content $pidFile -Raw).Trim()
  if ($pidText -match '^\d+$') { Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}
# Also kill any node process running our resolver script.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*dsh-send-path*src\resolver.mjs*' -or $_.CommandLine -like '*drop-resolver\resolver.mjs*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# 4) Restore the original DSH bundle.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
  & $node (Join-Path $tools 'patch-dsh-bundle.mjs') --restore
}

Write-Host 'Done. Restart Explorer once to drop the cached menu.' -ForegroundColor Green
