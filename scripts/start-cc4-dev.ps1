# Start Character Creator 4 in bridge dev mode (hot reload of cc4_api.py).
#   powershell -ExecutionPolicy Bypass -File D:\Business\Code\art\cc5-mcp-server\scripts\start-cc4-dev.ps1
# The reload secret is read from characters\_testbench\.cc4_reload_secret and never printed.

$secretFile = "D:\Business\Code\art\characters\_testbench\.cc4_reload_secret"
$exe = "C:\Program Files\Reallusion\Character Creator 4\Bin64\CharacterCreator.exe"

if (Get-Process CharacterCreator -ErrorAction SilentlyContinue) {
    Write-Host "Character Creator is already running. Close it first to restart in dev mode."
    exit 1
}
if (-not (Test-Path $secretFile)) {
    Write-Host "Reload secret not found: $secretFile"
    exit 1
}

$env:CC4_DEV_MODE = "1"
$env:CC4_RELOAD_SECRET = (Get-Content $secretFile -Raw).Trim()
Start-Process $exe
Write-Host "Character Creator 4 started in dev mode; the bridge is up about 20 s after launch."
