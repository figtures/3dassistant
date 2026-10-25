# Windows installer — NSIS + isteğe bağlı signtool
param(
  [string]$Version = $env:PRINTFLOW_BRIDGE_VERSION
)
if (-not $Version) { $Version = "0.1.0" }

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Nsis = Get-Command makensis -ErrorAction SilentlyContinue
if (-not $Nsis) {
  Write-Error "NSIS (makensis) gerekli: https://nsis.sourceforge.io/"
  exit 1
}

$env:PRINTFLOW_BRIDGE_VERSION = $Version
Push-Location $PSScriptRoot
& makensis /DPRINTFLOW_BRIDGE_VERSION=$Version printflow-bridge.nsi
Pop-Location

$Exe = Join-Path $Root "dist\printflow-bridge_${Version}_windows_amd64-setup.exe"
if ($env:SIGNTOOL_PATH -and $env:WINDOWS_SIGN_CERT) {
  & $env:SIGNTOOL_PATH sign /fd SHA256 /a /f $env:WINDOWS_SIGN_CERT $Exe
}
Write-Host "→ $Exe"
