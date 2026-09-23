# CC4 MCP Bridge plugin installer. Run in an Administrator PowerShell:
#   powershell -ExecutionPolicy Bypass -File install-plugin.ps1
param(
    [string]$CC4Root = $(if ($env:CC4_ROOT) { $env:CC4_ROOT } else { "C:\Program Files\Reallusion\Character Creator 4" })
)
$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "cc4-plugin"
$dest   = Join-Path $CC4Root "Bin64\OpenPlugin\CC4_MCP_Bridge"

if (-not (Test-Path (Join-Path $CC4Root "Bin64\CharacterCreator.exe"))) {
    throw "Character Creator 4 not found under $CC4Root (pass -CC4Root)."
}
if (Get-Process CharacterCreator -ErrorAction SilentlyContinue) {
    Write-Warning "Character Creator is running. Close it first so the new plugin is loaded on next launch."
}

if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
    Write-Host "Removed old plugin." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($f in "main.py", "server.py", "cc4_api.py", "config.json", "config.xml") {
    Copy-Item (Join-Path $source $f) $dest
}

Write-Host "Plugin installed to: $dest" -ForegroundColor Green
Write-Host "Launch Character Creator 4; the bridge listens on http://127.0.0.1:5101" -ForegroundColor Cyan
