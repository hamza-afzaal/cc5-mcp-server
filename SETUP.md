# CC4 Bridge Starter: setup

Unzip this bundle into the **root of your forked bridge repo**. It adds:

```
docs/
  cc4-bridge-kickoff-v2.md                 ← what Claude Code executes
  craftxr-character-pipeline-design.md     ← design v0.3 (pipeline, budgets, gates, recipes)
  craftxr-character-color-realism-spec.md  ← color management, clinical signs, realism quirks
  probe1.json                              ← YOU copy in (step 3)
  probe2.json                              ← YOU copy in (step 3)
.claude/skills/character-color-calibration/  ← our skill (project-scoped)
tools/probes/                              ← the two CC4 probe scripts, for reference
```

## Prerequisites (Windows PC with CC4 4.70)
- Git for Windows (the Claude desktop app's Code tab needs it)
- Node.js 18+
- Claude desktop app (Code tab) or the Claude Code CLI

## Steps

1. **Fork and clone.** Fork `github.com/mackatwentytsuru/cc5-mcp-server` on GitHub, then:
   ```powershell
   git clone https://github.com/<you>/cc5-mcp-server C:\dev\cc4-mcp-bridge
   cd C:\dev\cc4-mcp-bridge
   ```
2. **Unzip this bundle** into `C:\dev\cc4-mcp-bridge` (merge folders).
3. **Copy in the probe results:**
   ```powershell
   Copy-Item "$env:TEMP\cc4_mcp_probe.json" docs\probe1.json
   Copy-Item "$env:TEMP\cc4_probe2.json"    docs\probe2.json
   ```
4. **Install the color-expert skill:**
   ```powershell
   npx skills add meodai/skill.color-expert
   ```
5. **Commit:**
   ```powershell
   git add docs .claude tools SETUP.md
   git commit -m "Add CC4 bridge design docs, probe results, skills"
   ```
6. **Start Claude Code** in `C:\dev\cc4-mcp-bridge` (desktop app → Code tab → open folder, or run `claude` in the folder) and send:
   > Read docs/cc4-bridge-kickoff-v2.md and all files it references, then execute it. Start with Phase 0 and stop for my review.

## Your touchpoints during the build
| When | What you do |
|---|---|
| End of Phase 0 | Review the porting plan and approve or adjust |
| Phase 1a | Run the install script in **Administrator PowerShell** when asked; launch CC4; enable the plugin in Plugin Manager if it isn't active |
| Spike 1 | In CC4's FBX export dialog, set InstaLOD **Merge Materials → by type** once and save it |
| Spike 7 | In Modify → **Optimize and Decimate**, save one **Custom** profile (clothing/hair reduction, texture size) |
| End of Phase 2 | Review the tool set |
| End of Phase 3 | Review the end-to-end test report (material/triangle counts vs design §4) |

## After the bridge works (not now)
This is milestone M2, done in the **Unity project repo**:
- Meta Quest plugin, Unity official skills, Unity MCP
- CCiC Unity Tools
- 3 SkinGen skin presets (light / medium / dark Monk tones) and 1 Headshot hero head

Separate instructions will cover it when you get there.
