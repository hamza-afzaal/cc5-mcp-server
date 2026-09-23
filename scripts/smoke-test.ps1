# CC4 MCP bridge smoke test: hits every endpoint of a running bridge.
#
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1 [-Keep]
#
# Needs Character Creator 4 running with the plugin. It rebuilds a scratch scene
# (CC4 Camila template) in characters\_testbench, sets values back to what they
# were (or undoes them), and deletes its project/FBX afterwards unless -Keep.
# Every route listed by GET /api must be exercised; convert_lod is SKIPPED
# because CC4 asks a person to confirm it. Exit code 1 on any failure.
param(
    [string]$Bridge = $(if ($env:CC4_BRIDGE_URL) { $env:CC4_BRIDGE_URL } else { "http://127.0.0.1:5101" }),
    [switch]$Keep
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Templates = "D:/Business/Reallusion/Reallusion Templates"
$CamilaPath = "$Templates/Actor/Character/CC4 Camila.ccAvatar"
$ShirtPath = "$Templates/Cloth/Shirts/Basic T-shirts.ccCloth"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

$results = New-Object System.Collections.ArrayList
$hit = @{}

function Invoke-Bridge {
    param([string]$Method, [string]$Path, $Body = $null, [hashtable]$Headers = @{}, [string]$ContentType = "application/json")
    $args = @{ Uri = "$Bridge$Path"; Method = $Method; UseBasicParsing = $true; Headers = $Headers; TimeoutSec = 320 }
    if ($Method -eq "POST") {
        $args.ContentType = $ContentType
        $args.Body = if ($null -eq $Body) { "{}" } elseif ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 -Compress }
    }
    try {
        $resp = Invoke-WebRequest @args
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Json = ($resp.Content | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $r = $_.Exception.Response
        if ($null -eq $r) { throw }
        $text = (New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd()
        $json = $null
        try { $json = $text | ConvertFrom-Json } catch { }
        return [pscustomobject]@{ Status = [int]$r.StatusCode; Json = $json }
    }
}

function Check {
    param([string]$Name, [string]$Method, [string]$Path, $Body = $null, [int[]]$Expect = @(200),
          [hashtable]$Headers = @{}, [string]$ContentType = "application/json", [scriptblock]$Assert = $null)
    $hit["$Method $Path"] = $true
    try {
        $r = Invoke-Bridge -Method $Method -Path $Path -Body $Body -Headers $Headers -ContentType $ContentType
        $ok = $Expect -contains $r.Status
        $note = ""
        if ($ok -and $Assert) {
            $msg = & $Assert $r
            if ($msg) { $ok = $false; $note = $msg }
        }
        if (-not $ok -and -not $note) {
            $note = "HTTP $($r.Status), expected $($Expect -join '/')"
            if ($r.Json -and $r.Json.error) { $note += ": $($r.Json.error)" }
        }
    } catch {
        $r = $null; $ok = $false; $note = $_.Exception.Message
    }
    [void]$results.Add([pscustomobject]@{ Result = $(if ($ok) { "PASS" } else { "FAIL" }); Check = $Name; Route = "$Method $Path"; Note = $note })
    return $r
}

function Skip([string]$Name, [string]$Route, [string]$Why) {
    $hit[$Route] = $true
    [void]$results.Add([pscustomobject]@{ Result = "SKIP"; Check = $Name; Route = $Route; Note = $Why })
}

function Wait-Job([string]$JobId, [int]$TimeoutSec = 300) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    do {
        $s = Invoke-Bridge -Method POST -Path "/job/status" -Body @{ job_id = $JobId }
        if ($s.Json.result.status -in @("done", "failed")) { return $s.Json.result }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    return $s.Json.result
}

Write-Host "CC4 bridge smoke test against $Bridge" -ForegroundColor Cyan

# --- 0. Liveness and discovery ---
$health = Check "health" GET "/health" -Assert { param($r) if ($r.Json.result.service -ne "cc4-mcp-bridge") { "unexpected service" } }
if (-not $health -or $health.Status -ne 200) { Write-Host "Bridge not reachable; is CC4 running?" -ForegroundColor Red; exit 1 }
$api = Check "api discovery" GET "/api"
$endpoints = @()
foreach ($p in $api.Json.result.endpoints.GET) { $endpoints += "GET $p" }
foreach ($p in $api.Json.result.endpoints.POST) { $endpoints += "POST $p" }

# --- 1. Security ---
[void](Check "reject browser Origin" GET "/avatars" -Headers @{ Origin = "https://evil.example" } -Expect 403)
[void](Check "reject non-JSON POST" POST "/diagnostics" -Body '{"query":"project_path"}' -ContentType "text/plain" -Expect 400)
[void](Check "reload needs token" POST "/reload" -Expect 403)
if ($env:CC4_RELOAD_SECRET) {
    [void](Check "reload with token" POST "/reload" -Headers @{ "X-Reload-Token" = $env:CC4_RELOAD_SECRET } -Expect @(200, 403))
}
[void](Check "no exec endpoint" POST "/exec/python" -Body @{ code = "1" } -Expect 404)

# --- 2. Scratch scene in _testbench ---
[void](Check "workspace -> _testbench" POST "/workspace/character" -Body @{ character = "" } -Assert { param($r) if ($r.Json.result.folder -notlike "*\characters\_testbench") { "folder is $($r.Json.result.folder)" } })
[void](Check "clear scene" POST "/avatar/delete" -Body @{ name = "" } -Expect @(200, 400))
[void](Check "load Camila template" POST "/item/load" -Body @{ file_path = $CamilaPath })
$status = Invoke-Bridge GET "/morphs/status"
if (-not $status.Json.result.ready) {
    Start-Sleep 5
    [void](Invoke-Bridge POST "/avatar/delete" @{ name = "" })
    [void](Invoke-Bridge POST "/item/load" @{ file_path = $CamilaPath })
}

# --- 3. Every GET route ---
[void](Check "morph catalog status" GET "/morphs/status" -Assert { param($r) if (-not $r.Json.result.ready) { "catalog not ready" } })
foreach ($p in @("/avatars", "/avatar/info", "/morphs/catalog", "/items", "/camera/info", "/lights", "/visual/settings", "/expressions", "/material/info", "/workspace")) {
    [void](Check "GET $p" GET $p)
}

# --- 4. Morphs (changed, then undone) ---
$search = Check "search morphs" POST "/morphs/search" -Body @{ query = "Nose Width"; limit = 3 } -Assert { param($r) if (-not $r.Json.result.results) { "no results" } }
$morphId = $search.Json.result.results[0].id
[void](Check "get morph" POST "/morph/get" -Body @{ morph_id = $morphId })
[void](Check "set morphs" POST "/morphs/set" -Body @{ morphs = @(@{ display_name = "Nose Width"; value = -0.2 }) })
[void](Check "unknown morph fails loudly" POST "/morphs/set" -Body @{ morphs = @(@{ display_name = "No Such Morph"; value = 0.1 }) } -Expect 400)
[void](Check "undo" POST "/undo")
[void](Check "redo" POST "/redo")
[void](Check "undo again" POST "/undo" -Assert {
    param($r)
    $v = (Invoke-Bridge POST "/morph/get" @{ morph_id = $morphId }).Json.result.value
    if ([math]::Abs($v) -gt 1e-4) { "morph not restored ($v)" }
})
[void](Check "reset morphs" POST "/morphs/reset")
[void](Invoke-Bridge POST "/undo")

# --- 5. Items and color ---
[void](Check "load item" POST "/item/load" -Body @{ file_path = $ShirtPath } -Assert { param($r) if (-not ($r.Json.result.added.clothes -contains "Basic T-shirts")) { "shirt not added" } })
[void](Check "remove item" POST "/item/remove" -Body @{ item_name = "Basic T-shirts" })
[void](Check "set eye color" POST "/color" -Body @{ target = "eyes"; r = 0.28; g = 0.22; b = 0.16 })
[void](Invoke-Bridge POST "/undo")
[void](Check "browse content" POST "/content/browse" -Body @{ folder_type = "shoes" })
[void](Check "diagnostics" POST "/diagnostics" -Body @{ query = "facial_profile_type" })
[void](Check "license check" POST "/license/check")

# --- 6. Camera, lights, visual settings (set back to current values) ---
[void](Check "frame camera" POST "/camera/frame" -Body @{ view = "front" })
[void](Check "focal length (Preview Camera may refuse)" POST "/camera/focal" -Body @{ focal_length = 50 } -Expect @(200, 400))
$lights = (Invoke-Bridge GET "/lights").Json.result
if ($lights -and $lights.Count -gt 0) {
    $name = $lights[0].name
    $info = (Check "light info" POST "/light/info" -Body @{ light_name = $name }).Json.result
    if ($info.color) { [void](Check "light color (same)" POST "/light/color" -Body @{ light_name = $name; r = $info.color.r; g = $info.color.g; b = $info.color.b }) }
    else { Skip "light color" "POST /light/color" "light has no readable color" }
    if ($null -ne $info.multiplier) { [void](Check "light multiplier (same)" POST "/light/multiplier" -Body @{ light_name = $name; multiplier = $info.multiplier }) }
    else { Skip "light multiplier" "POST /light/multiplier" "no readable multiplier" }
    if ($null -ne $info.active) { [void](Check "light active (same)" POST "/light/active" -Body @{ light_name = $name; active = [bool]$info.active }) }
    else { Skip "light active" "POST /light/active" "no readable state" }
    if ($null -ne $info.cast_shadow) { [void](Check "light shadow (same)" POST "/light/shadow" -Body @{ light_name = $name; cast_shadow = [bool]$info.cast_shadow }) }
    else { Skip "light shadow" "POST /light/shadow" "no readable shadow state" }
} else {
    foreach ($r in @("/light/info", "/light/color", "/light/multiplier", "/light/active", "/light/shadow")) { Skip "lights" "POST $r" "scene has no lights" }
}
$vs = (Invoke-Bridge GET "/visual/settings").Json.result
if ($vs.ambient) { [void](Check "ambient (same)" POST "/visual/ambient" -Body @{ r = $vs.ambient.r; g = $vs.ambient.g; b = $vs.ambient.b }) }
else { Skip "ambient" "POST /visual/ambient" "ambient not readable" }
[void](Check "IBL toggle (same)" POST "/visual/ibl" -Body @{ enable = [bool]$vs.ibl_enabled })

# --- 7. Materials (set back to current values) ---
[void](Check "material info" POST "/material/info")
$eye = (Check "diffuse get" POST "/material/color/get" -Body @{ mesh_name = "CC_Base_Eye"; material_name = "Std_Eye_R" }).Json.result
if ($eye) { [void](Check "diffuse set (same)" POST "/material/color/set" -Body @{ mesh_name = "CC_Base_Eye"; material_name = "Std_Eye_R"; r = $eye.r; g = $eye.g; b = $eye.b }) }
$shader = (Check "shader get" POST "/material/shader/get" -Body @{ mesh_name = "CC_Base_Body"; material_name = "Std_Skin_Head" }).Json.result
$param = $shader.parameters.PSObject.Properties | Select-Object -First 1
if ($param) {
    [void](Check "shader set (same)" POST "/material/shader/set" -Body @{ mesh_name = "CC_Base_Body"; material_name = "Std_Skin_Head"; parameter_name = $param.Name; values = @($param.Value) })
} else { Skip "shader set" "POST /material/shader/set" "no shader parameters" }

# --- 8. Renders, save-as, export and merge jobs ---
[void](Check "capture views" POST "/views/capture" -Body @{ presets = @("full"); prefix = "smoke_$Stamp" } -Assert { param($r) if (-not $r.Json.result.views[0].base64) { "no image" } })
[void](Check "save-as outside workspace refused" POST "/project/save_as" -Body @{ path = "C:/Users/Public/smoke_$Stamp.ccProject" } -Expect 400)
$saved = Check "save project as" POST "/project/save_as" -Body @{ path = "smoke_$Stamp" } -Assert { param($r) if (-not $r.Json.result.is_current) { "copy is not current" } }
$job = Check "start export job" POST "/job/start" -Body @{ action = "export_fbx"; params = @{ output_path = "smoke_$Stamp.fbx"; target_tool = "Unity"; export_json = $true; export_motion = $false; delete_hidden_faces = $true; remove_tearline_occlusion = $true } }
$exp = Wait-Job $job.Json.result.job_id
$hit["POST /job/status"] = $true
[void]$results.Add([pscustomobject]@{
    Result = $(if ($exp.status -eq "done" -and $exp.result.json_exists) { "PASS" } else { "FAIL" }); Check = "export job finished + JSON"; Route = "POST /job/status"
    Note = "$($exp.status) $($exp.result.path) $($exp.result.error)" })
$merge = Invoke-Bridge POST "/job/start" @{ action = "merge_materials"; params = @{} }
$m = Wait-Job $merge.Json.result.job_id
[void]$results.Add([pscustomobject]@{ Result = $(if ($m.status -eq "done") { "PASS" } else { "FAIL" }); Check = "merge_materials job (saved copy)"; Route = "POST /job/start"; Note = "$($m.status) $($m.result.error)" })
Skip "convert_lod" "job convert_lod" "irreversible; CC4 shows two OK dialogs that need a person"

# --- 9. Neutral avatar create/delete ---
$created = Check "create neutral avatar" POST "/avatar/create"
if ($created.Json.result.name) { [void](Check "delete that avatar" POST "/avatar/delete" -Body @{ name = $created.Json.result.name }) }

# --- Coverage of /api ---
foreach ($e in $endpoints) {
    if (-not $hit.ContainsKey($e)) {
        [void]$results.Add([pscustomobject]@{ Result = "FAIL"; Check = "endpoint not exercised"; Route = $e; Note = "add it to scripts/smoke-test.ps1" })
    }
}

# --- Cleanup ---
if (-not $Keep) {
    $ws = (Invoke-Bridge GET "/workspace").Json.result.folder
    foreach ($f in @("projects\smoke_$Stamp.ccProject", "exports\smoke_$Stamp.fbx", "exports\smoke_$Stamp.json", "exports\smoke_$Stamp.fbm", "renders\smoke_${Stamp}_full.png")) {
        $full = Join-Path $ws $f
        if (Test-Path $full) { Remove-Item -Recurse -Force $full }
    }
}

$results | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Host
$fail = @($results | Where-Object Result -eq "FAIL").Count
$pass = @($results | Where-Object Result -eq "PASS").Count
$skip = @($results | Where-Object Result -eq "SKIP").Count
$color = if ($fail) { "Red" } else { "Green" }
Write-Host "PASS $pass  FAIL $fail  SKIP $skip  (endpoints listed by /api: $($endpoints.Count))" -ForegroundColor $color
exit $(if ($fail) { 1 } else { 0 })
