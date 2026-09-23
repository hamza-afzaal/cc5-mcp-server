# CC4 MCP Bridge plugin installer. Run in an Administrator PowerShell with CC4 closed:
#   powershell -ExecutionPolicy Bypass -File install-plugin.ps1              # install / repair
#   powershell -ExecutionPolicy Bypass -File install-plugin.ps1 -Uninstall   # remove
#
# CC4 only loads plugins from its own Bin64\OpenPlugin folder, so this creates
# OpenPlugin\CC4_MCP_Bridge as a directory JUNCTION to this repo's cc4-plugin
# folder. No code is copied into Program Files; repo edits take effect on the
# next CC4 start. It also creates the characters workspace next to the repo.
param(
    [string]$CC4Root = $(if ($env:CC4_ROOT) { $env:CC4_ROOT } else { "C:\Program Files\Reallusion\Character Creator 4" }),
    [switch]$Uninstall
)
$ErrorActionPreference = "Stop"

$source    = Join-Path $PSScriptRoot "cc4-plugin"
$dest      = Join-Path $CC4Root "Bin64\OpenPlugin\CC4_MCP_Bridge"
$workspace = Join-Path (Split-Path $PSScriptRoot -Parent) "characters"

if (-not (Test-Path (Join-Path $CC4Root "Bin64\CharacterCreator.exe"))) {
    throw "Character Creator 4 not found under $CC4Root (pass -CC4Root)."
}
if (Get-Process CharacterCreator -ErrorAction SilentlyContinue) {
    throw "Character Creator is running. Close it first, then run this again."
}

# Remove whatever is there now: an old junction (unlink only) or an old copied folder.
if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        # Deleting a junction removes the link, never the files it points to.
        [IO.Directory]::Delete($dest)
        Write-Host "Removed old junction: $dest" -ForegroundColor Yellow
    } else {
        Remove-Item -Recurse -Force $dest
        Write-Host "Removed old copied plugin folder: $dest" -ForegroundColor Yellow
    }
}

if ($Uninstall) {
    Write-Host "Uninstalled. (Nothing in $source or $workspace was touched.)" -ForegroundColor Green
    return
}

New-Item -ItemType Junction -Path $dest -Target $source | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $workspace "_testbench") | Out-Null

Write-Host "Plugin linked: $dest -> $source" -ForegroundColor Green
Write-Host "Workspace:     $workspace" -ForegroundColor Green
Write-Host "Launch Character Creator 4; the bridge listens on http://127.0.0.1:5101" -ForegroundColor Cyan
