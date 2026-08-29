# dsh-send-path installer — sends the right-clicked file/folder's absolute path
# into the open DeepSeek Harness dialog (press F while the menu is open).
# No admin required: everything lives under HKCU and the user profile.
param(
  [string]$BundlePath = ''  # optional: explicit path to the ui-attachment client.js
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'
$tools = Join-Path $root 'tools'

Write-Host 'dsh-send-path installer' -ForegroundColor Cyan

# 1) Patch the DSH web bundle (the page side that inserts into the composer).
Write-Host '[1/4] Patching DSH web bundle...'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error 'Node.js is required (DSH itself runs on it). Install Node.js first.' }
$patchScript = Join-Path $tools 'patch-dsh-bundle.mjs'
if ($BundlePath) {
  & $node $patchScript --bundle $BundlePath
} else {
  & $node $patchScript
}
if ($LASTEXITCODE -eq 1) { Write-Error "Bundle patch failed (exit 1); see messages above." }
elseif ($LASTEXITCODE -eq 2) {
  Write-Warning 'DSH web bundle not found. The context menu will still work once DSH is installed; re-run this installer then.'
}

# 2) Register the Explorer context menu (files + folders).
Write-Host '[2/4] Registering context menu...'
$label = '发送到 DSH 输入框(&F)'
$vbs   = Join-Path $src 'send-path.vbs'
$icon  = Join-Path $src 'dsh-menu.ico'
$cmd   = 'wscript.exe "' + $vbs + '" "%1"'
foreach ($base in @(
  'HKCU:\Software\Classes\*\shell\DSHSendPath',
  'HKCU:\Software\Classes\Directory\shell\DSHSendPath'
)) {
  New-Item -Path "$base\command" -ItemType Key -Force -ErrorAction SilentlyContinue | Out-Null
  Set-ItemProperty -LiteralPath $base -Name '(default)' -Value $label
  Set-ItemProperty -LiteralPath $base -Name 'Icon' -Value $icon
  Set-ItemProperty -LiteralPath "$base\command" -Name '(default)' -Value $cmd
}

# 3) Autostart the resolver at logon + start it now.
Write-Host '[3/4] Autostart + starting the resolver...'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Set-ItemProperty -LiteralPath $runKey -Name 'dsh-send-path' -Value ('wscript.exe "' + (Join-Path $src 'start-resolver.vbs') + '"')
Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + (Join-Path $src 'start-resolver.vbs') + '"') -WindowStyle Hidden

# 4) Done.
Write-Host '[4/4] Done!' -ForegroundColor Green
Write-Host ''
Write-Host '  Usage: right-click a file/folder in Explorer, press F (menu is open),'
Write-Host '         the absolute path lands in the DSH dialog.'
Write-Host '  If the menu does not show the new item, restart Explorer once'
Write-Host '  (Task Manager -> Windows Explorer -> Restart).'
