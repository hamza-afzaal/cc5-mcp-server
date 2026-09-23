# CC4 MCP Bridge — development rules

## Environment
- Character Creator 4.70, embedded **Python 3.8.8**, **PySide2**. Plugin folder: `C:\Program Files\Reallusion\Character Creator 4\Bin64\OpenPlugin\CC4_MCP_Bridge\`.
- Plugin code must parse as Python 3.8 and keep `from __future__ import annotations` (checked by `npm run test:py`).
- CC4's API wrapper is on disk: `C:\Program Files\Reallusion\Character Creator 4\Bin64\RLPy.py`. Check a signature there (or in `docs/rlpy-api-reference.md`) **before** writing any RLPy call. A wrong SWIG argument type can crash CC4 rather than raise.

## Bridge
- Port 5101; health: `curl -s http://127.0.0.1:5101/health` (answered from the HTTP thread, never touches RLPy).
- The action registry (`ACTIONS`, `GET_ROUTES`, `POST_ROUTES`, `JOB_ACTIONS`, `DIAGNOSTIC_QUERIES`) lives in `cc4-plugin/cc4_api.py`. Add or change actions there only.
- Hot reload of `cc4_api.py` only: `POST /reload` with header `X-Reload-Token: $CC4_RELOAD_SECRET`, and only when CC4 was started with `CC4_DEV_MODE=1` and a non-empty `CC4_RELOAD_SECRET`. A change to `server.py` or `main.py` needs a CC4 restart.
- Long actions (`export_fbx`, `load_asset`, `create_default_avatar`) can run as jobs: `POST /job/start {action, params}` → `POST /job/status {job_id}`.
- The bridge refuses browser-origin requests (Origin / Sec-Fetch-Site), non-loopback Host headers, and POSTs without `Content-Type: application/json`.
- No arbitrary code execution. Use the `diagnostics` allowlist for introspection; extend the allowlist with read-only queries only.

## RLPy constraints
- RLPy is not thread-safe: only call it from actions dispatched by the QTimer queue.
- Wrap every mutating call in `RGlobal.BeginAction()` / `EndAction()` (try/finally) and call `RGlobal.ObjectModified()` afterwards.
- `ConvertTo` (ActorBUILD / LOD) is irreversible: only on a project saved-as in this session (design D6).
- No Win32 dialog automation, no OS screenshots. If a call opens a modal dialog, report "manual action required in CC4".

## Workflow for a new action
1. Confirm the API in CC4's `RLPy.py`.
2. Add the function and its `ACTIONS`/route entries in `cc4_api.py`.
3. Add a stub to `tests/bridge/fake_rlpy.py` if the offline tests need it; `npm run test:py`.
4. Reload (dev mode) or restart CC4, then exercise it with `curl`.
5. TypeScript: `types.ts` → `cc4-bridge.ts` → `tools/*.ts` → `index.ts`; `npm run build && npm test`.

## Never commit
Exported FBX/JSON/textures, saved project copies, or anything under `CC4Export/` (see `.gitignore`).
