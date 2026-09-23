"""
CC4 RLPy API wrapper functions (Character Creator 4.70, embedded Python 3.8).

Provides a clean interface over RLPy for character manipulation.
All functions MUST be called from the main thread (via QTimer queue).

This module also owns the bridge's action registry (ACTIONS / GET_ROUTES /
POST_ROUTES at the bottom). server.py reads it after every hot reload, so a
new or changed action only needs editing here.

Ported from mackatwentytsuru/cc5-mcp-server (CC5 bridge) by macka.
"""

from __future__ import annotations

import os
import sys
import base64
import time
import urllib.parse
from typing import Any

import RLPy

# --- Path validation (defense-in-depth, mirrors TypeScript validation) ---

_ALLOWED_LOAD_EXTENSIONS = {
    ".iavatar", ".ccavatar", ".ccm", ".iclothes", ".ihair", ".iprop",
    ".ccfbx", ".iclothing", ".ishoe", ".iaccessory", ".ibody", ".iskin",
    ".ccproject",
}

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

MAX_MORPH_ID_LENGTH = 256

# --- Workspace: every file the bridge writes stays under one folder ---
#
# Default: <art>/characters, found from this file's real location
# (<art>/cc5-mcp-server/cc4-plugin/cc4_api.py; realpath follows the OpenPlugin
# junction). CC4_WORKSPACE overrides it. Layout:
#   <workspace>/<character id>/{projects,exports,renders,reports}
#   <workspace>/_testbench/{projects,exports,renders,reports}   (no character set)

import bridge_state

WORKSPACE_ROOT = os.path.realpath(os.environ.get("CC4_WORKSPACE") or os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "..", "..", "characters"))
TESTBENCH = "_testbench"
_CHARACTER_ID_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789-_")


def _is_within(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.normcase(os.path.realpath(path)), os.path.normcase(root)]) == os.path.normcase(root)
    except ValueError:  # different drives
        return False


def character_dir(kind: str = "") -> str:
    """Folder for the current character (or _testbench), optionally a subfolder."""
    base = os.path.join(WORKSPACE_ROOT, bridge_state.current_character or TESTBENCH)
    return os.path.join(base, kind) if kind else base


def workspace_path(path: str, kind: str) -> tuple[str | None, str | None]:
    """Resolve an output path. Bare names go to <character>/<kind>/; anything else
    must already be inside the workspace. Returns (path, error)."""
    decoded = urllib.parse.unquote(path or "")
    if not decoded or "\x00" in decoded or ".." in decoded:
        return None, "Unsafe or empty path"
    if not os.path.isdir(WORKSPACE_ROOT):
        return None, f"Workspace folder does not exist: {WORKSPACE_ROOT} (create it or set CC4_WORKSPACE)"
    if os.path.dirname(path) == "":
        path = os.path.join(character_dir(kind), path)
    if not _is_within(path, WORKSPACE_ROOT):
        return None, f"Refusing to write outside the workspace ({WORKSPACE_ROOT}): {path}"
    return path, None


def set_character(character_id: str = "") -> dict[str, Any]:
    """Select where bare output names go: <workspace>/<id>/..., or _testbench when empty."""
    cid = (character_id or "").strip()
    if cid and (not set(cid) <= _CHARACTER_ID_CHARS or cid.startswith(("-", "_")) or len(cid) > 64):
        return {"success": False, "error": "character id must be lowercase letters, digits, '-' or '_' (max 64)"}
    bridge_state.current_character = cid or None
    folder = character_dir()
    return {"success": True, "character": bridge_state.current_character, "folder": folder}


def workspace_info() -> dict[str, Any]:
    return {"root": WORKSPACE_ROOT, "exists": os.path.isdir(WORKSPACE_ROOT),
            "character": bridge_state.current_character, "folder": character_dir()}

# UR-25: prefer EObjectModifiedType_Material for material/color changes.
# Falls back to _Attribute if _Material is not in this build.
_EOMTYPE_MATERIAL = (
    RLPy.EObjectModifiedType_Material
    if hasattr(RLPy, "EObjectModifiedType_Material")
    else RLPy.EObjectModifiedType_Attribute
)


def _validate_morph_id(morph_id: str) -> str | None:
    """Validate morph ID length. Returns error message or None."""
    if len(morph_id) > MAX_MORPH_ID_LENGTH:
        return f"Morph ID too long ({len(morph_id)} chars, max {MAX_MORPH_ID_LENGTH})"
    return None


def _validate_path(file_path: str, allowed_extensions: set[str]) -> str | None:
    """Validate a file path. Returns error message or None if valid."""
    # Defense-in-depth: catch percent-encoded ('%2e%2e') dot segments too.
    decoded = urllib.parse.unquote(file_path)
    if "\x00" in file_path or "\x00" in decoded:
        return "Path contains null byte"
    if ".." in file_path or ".." in decoded:
        return "Path traversal ('..') is not allowed"
    resolved = os.path.realpath(file_path)
    ext = os.path.splitext(resolved)[1].lower()
    if ext not in allowed_extensions:
        return f"Disallowed file extension: {ext}"
    return None


# --- Avatar helpers ---

def get_avatars() -> list[dict[str, Any]]:
    """Get all avatars in the current scene."""
    avatars = RLPy.RScene.GetAvatars()
    return [
        {
            "name": avatar.GetName(),
            "id": avatar.GetID(),
            "type": str(avatar.GetType()),
        }
        for avatar in avatars
    ]


def get_first_avatar():
    """Get the first avatar in the scene (or None)."""
    avatars = RLPy.RScene.GetAvatars()
    return avatars[0] if avatars else None


def get_avatar_by_name(name: str = ""):
    """Get an avatar by name, or the first avatar if no name given."""
    avatars = RLPy.RScene.GetAvatars()
    if not avatars:
        return None
    if not name:
        return avatars[0]
    for avatar in avatars:
        if avatar.GetName() == name:
            return avatar
    return None


# --- Morph helpers ---

_morph_id_cache: dict[int, set[str]] = {}
_morph_catalog_cache: dict[int, dict[str, list[dict[str, str]]]] = {}


def _get_all_morph_ids() -> set[str]:
    """Get all known morph IDs for the current avatar (cached per avatar ID)."""
    avatar = get_first_avatar()
    if not avatar:
        return set()
    avatar_id = avatar.GetID()
    if avatar_id in _morph_id_cache:
        return _morph_id_cache[avatar_id]
    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return set()
    all_ids: set[str] = set()
    categories = shaping_comp.GetShapingMorphCatergoryNames()
    for cat in categories:
        ids = shaping_comp.GetShapingMorphIDs(cat)
        all_ids.update(ids)
    _morph_id_cache[avatar_id] = all_ids
    return all_ids


def _invalidate_caches() -> None:
    """Clear morph ID and catalog caches (call after scene changes)."""
    _morph_id_cache.clear()
    _morph_catalog_cache.clear()


def get_morph_catalog() -> dict[str, list[dict[str, str]]]:
    """Enumerate all available shaping morph IDs, grouped by category (cached per avatar ID)."""
    avatar = get_first_avatar()
    if not avatar:
        return {}
    avatar_id = avatar.GetID()
    if avatar_id in _morph_catalog_cache:
        return _morph_catalog_cache[avatar_id]

    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return {}

    catalog: dict[str, list[dict[str, str]]] = {}
    categories = shaping_comp.GetShapingMorphCatergoryNames()

    for cat in categories:
        ids = shaping_comp.GetShapingMorphIDs(cat)
        names = shaping_comp.GetShapingMorphDisplayNames(cat)
        catalog[cat] = [
            {"id": ids[i], "display_name": names[i] if i < len(names) else ids[i]}
            for i in range(len(ids))
        ]

    _morph_catalog_cache[avatar_id] = catalog
    return catalog


MAX_SEARCH_RESULTS = 200


def search_morphs(query: str, category: str = "") -> list[dict[str, str]]:
    """Search morph catalog by display name. Returns matching morphs.
    Iterates the catalog cache populated by get_morph_catalog (UR-12).
    """
    if not query.strip():
        return []
    query_lower = query.lower()
    avatar = get_first_avatar()
    if not avatar:
        return []
    catalog = get_morph_catalog()
    if not catalog:
        return []
    results: list[dict[str, str]] = []
    for cat, entries in catalog.items():
        if category and category.lower() not in cat.lower():
            continue
        for entry in entries:
            morph_id = entry["id"]
            display = entry["display_name"]
            if query_lower in display.lower() or query_lower in morph_id.lower():
                results.append({"id": morph_id, "display_name": display, "category": cat})
    # Deduplicate by ID
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for r in results:
        if r["id"] not in seen:
            seen.add(r["id"])
            unique.append(r)
    return unique[:MAX_SEARCH_RESULTS]


def get_morph_value(morph_id: str) -> dict[str, Any]:
    """Get current value of a shaping morph slider."""
    error = _validate_morph_id(morph_id)
    if error:
        return {"success": False, "error": error}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return {"success": False, "error": "No shaping component found"}

    value = shaping_comp.GetShapingMorphWeight(morph_id)
    return {"success": True, "morph_id": morph_id, "value": value}


def set_morph_value(morph_id: str, value: float) -> dict[str, Any]:
    """Set a shaping morph slider value (0.0 - 1.0)."""
    error = _validate_morph_id(morph_id)
    if error:
        return {"success": False, "error": error}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return {"success": False, "error": "No shaping component found"}

    # Validate morph ID exists
    known_ids = _get_all_morph_ids()
    if known_ids and morph_id not in known_ids:
        return {"success": False, "error": f"Unknown morph ID: {morph_id}"}

    value = max(-1.0, min(1.0, value))
    try:
        RLPy.RGlobal.BeginAction("Set Morph")
        shaping_comp.SetShapingMorphWeight(morph_id, value)
        RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()

    return {"success": True, "morph_id": morph_id, "value": value}


MAX_MORPH_BATCH = 500


def set_multiple_morphs(morphs: list[dict[str, Any]]) -> dict[str, Any]:
    """Set multiple morph values at once. Each entry: {"morph_id": str, "value": float} (also accepts "id")."""
    if len(morphs) > MAX_MORPH_BATCH:
        return {"success": False, "error": f"Too many morphs: {len(morphs)}, max {MAX_MORPH_BATCH}"}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return {"success": False, "error": "No shaping component found"}

    # Normalize and validate all entries before applying any
    normalized: list[tuple[str, float]] = []
    for morph in morphs:
        morph_id = morph.get("morph_id", morph.get("id"))
        if not morph_id or "value" not in morph:
            return {"success": False, "error": "Morph entry missing 'morph_id' or 'value'"}
        error = _validate_morph_id(morph_id)
        if error:
            return {"success": False, "error": error}
        normalized.append((morph_id, float(morph["value"])))

    # Validate morph IDs
    known_ids = _get_all_morph_ids()
    if known_ids:
        unknown = [mid for mid, _ in normalized if mid not in known_ids]
        if unknown:
            return {"success": False, "error": f"Unknown morph ID(s): {', '.join(unknown)}"}

    try:
        RLPy.RGlobal.BeginAction("Set Multiple Morphs")
        results = []
        for morph_id, raw_value in normalized:
            value = max(-1.0, min(1.0, raw_value))
            shaping_comp.SetShapingMorphWeight(morph_id, value)
            results.append({"morph_id": morph_id, "value": value})

        RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "applied": results}


def _get_cc4_root() -> str:
    """Get CC4 installation root, using RLPy if available.
    GetProgramPath() may return either the exe path (.../Bin64/CharacterCreator.exe)
    or the Bin64 directory. Guard the dirname depth accordingly:
    exe (file) -> Bin64 -> root (dirname twice); Bin64 (dir) -> root (dirname once).
    """
    if hasattr(RLPy, "RApplication") and hasattr(RLPy.RApplication, "GetProgramPath"):
        try:
            app_path = RLPy.RApplication.GetProgramPath()
            if app_path:
                if os.path.isfile(app_path):
                    # exe -> Bin64 -> CC4 root
                    candidate = os.path.dirname(os.path.dirname(app_path))
                else:
                    # Bin64 dir -> CC4 root
                    candidate = os.path.dirname(app_path)
                if os.path.isdir(candidate):
                    return candidate
        except Exception:
            pass
    return os.environ.get("CC4_ROOT", r"C:\Program Files\Reallusion\Character Creator 4")


def create_default_avatar() -> dict[str, Any]:
    """Load the CC4 NEUTRAL base avatar (additive, does not clear scene).

    NOTE: this neutral base has NO skin/eye textures, eyebrows, eyelashes or hair —
    it renders like a pale, blank-eyed mannequin. For a real, textured human face,
    load a character template (e.g. Camila) with load_item instead.
    Use delete_avatar first if you want to replace what's already in the scene.
    """
    cc4_root = _get_cc4_root()

    # Use .ccAvatar (additive load — does not replace the scene)
    avatar_path = os.path.join(cc4_root, "Program", "CCBaseData", "NeutralAvatar", "RL_CC3_Plus.ccAvatar")
    if not os.path.exists(avatar_path):
        return {"success": False, "error": f"Default avatar not found: {avatar_path}"}

    try:
        result = RLPy.RFileIO.LoadFile(avatar_path)
        _invalidate_caches()
        avatars = RLPy.RScene.GetAvatars()
        name = avatars[-1].GetName() if avatars else "Unknown"
        avatar_id = avatars[-1].GetID() if avatars else None
        return {"success": True, "name": name, "id": avatar_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


def delete_avatar(name: str = "") -> dict[str, Any]:
    """Delete an avatar from the scene by name. If name is empty, deletes ALL avatars.

    Useful to clear a neutral mannequin before loading a textured character template,
    or to start the scene over. Uses RScene.RemoveObject.
    """
    avatars = RLPy.RScene.GetAvatars()
    if not avatars:
        return {"success": False, "error": "No avatars in scene"}
    target = (name or "").strip()
    removed: list[str] = []
    try:
        RLPy.RGlobal.BeginAction("Delete Avatar")
        for avatar in list(avatars):
            aname = avatar.GetName()
            if not target or aname == target:
                RLPy.RScene.RemoveObject(avatar)
                removed.append(aname)
    finally:
        RLPy.RGlobal.EndAction()
    _invalidate_caches()
    if not removed:
        return {"success": False, "error": f"Avatar not found: {target}"}
    return {"success": True, "removed": removed}




def export_fbx(
    output_path: str,
    options_flags: int = 0,
    target_tool: str = "",
    sub_d_level: int | None = None,
    include_current_pose: bool = False,
    delete_hidden_faces: bool = False,
    use_smooth_mesh: bool = False,
    remove_eyelash: bool = False,
    remove_tearline_occlusion: bool = False,
    embed_textures: bool = False,
    export_motion: bool = True,
    fps: int | None = None,
    motion_range: list | None = None,
    convert_image_format: bool = False,
    texture_size: int | None = None,
    export_json: bool = False,
    instalod_preset: bool = False,
    include_motion_path: str = "",
    motion_only: bool = False,
) -> dict[str, Any]:
    """Export the current avatar as FBX via RExportFbxSetting (CC4 export dialog parity).

    Args:
        output_path: .fbx destination. A bare filename (no directory component)
            goes to <workspace>/<character>/exports/; other paths must be inside the workspace.
        options_flags: Raw EExportFbxOptions bitmask. If 0, defaults are computed from named flags.
        target_tool: "Unity" | "UE5" | "Maya" | "" - sets the base flag preset.
        sub_d_level: 0|1|2 export subdivision level via SetExportLevel (no scene mutation).
        include_current_pose: Keep the current pose (do NOT force T-pose on first motion frame).
        delete_hidden_faces: EExportFbxOptions_RemoveHiddenMesh.
        use_smooth_mesh: RExportFbxSetting.EnableBakeSubdivision(True).
        remove_eyelash: EExportFbxOptions_RemoveEyelash.
        remove_tearline_occlusion: EExportFbxOptions_RemoveTearLineAndOcclusion.
        embed_textures: EExportFbxOptions_EmbedTexture.
        export_motion: "Mesh and Motion" when True, "Mesh" only when False.
        fps: frame rate for included motion (RLPy.RFps.Fps{n}).
        motion_range: [start, end] frame range; None keeps "All".
        convert_image_format: EExportFbxOptions_ConvertTifToPNG.
        texture_size: max texture size in px (0 = original).
        export_json: EExportFbxOptions3_ExportJson (needed by CCiC Unity Tools).
        instalod_preset: EExportFbxOptions2_InstaLodPreset. No effect from Python (spike 1); kept for completeness.
        include_motion_path: motion file exported with the avatar (RExportFbxSetting.SetIncludeMotionPath).
        motion_only: EExportFbxOptions_RemoveAllMesh (skeleton + animation only).

    There is deliberately no flag-less 2-arg fallback: if RExportFbxSetting fails
    the export fails, so a result never claims options that were not applied.
    """
    _decoded_out = urllib.parse.unquote(output_path)
    if "\x00" in output_path or "\x00" in _decoded_out:
        return {"success": False, "error": "Path contains null byte"}
    if ".." in output_path or ".." in _decoded_out:
        return {"success": False, "error": "Path traversal ('..') is not allowed"}

    notes: list[str] = []

    output_path, path_error = workspace_path(output_path, "exports")
    if path_error:
        return {"success": False, "error": path_error}

    resolved = os.path.realpath(output_path)
    if not resolved.lower().endswith(".fbx"):
        return {"success": False, "error": "Output path must end with .fbx"}

    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    if not hasattr(RLPy, "RExportFbxSetting"):
        return {"success": False, "error": "RLPy.RExportFbxSetting not available in this CC4 build"}

    _MISSING_FLAG = object()

    def _safe_flag(name: str) -> int:
        val = getattr(RLPy, name, _MISSING_FLAG)
        if val is _MISSING_FLAG:
            notes.append(f"WARNING: RLPy.{name} not found, flag skipped")
            return 0
        return int(val)

    flags = int(options_flags) if options_flags else 0
    flags2 = 0
    flags3 = 0

    target_upper = (target_tool or "").upper()
    if target_upper in ("UE5", "UNREAL"):
        flags |= _safe_flag("EExportFbxOptions_AutoSkinRigidMesh")
        flags |= _safe_flag("EExportFbxOptions_ExportRootMotion")
        flags |= _safe_flag("EExportFbxOptions_RemoveAllUnused")
        flags2 |= _safe_flag("EExportFbxOptions2_UnrealPreset")
        flags2 |= _safe_flag("EExportFbxOptions2_UnrealEngine4BoneAxis")
        flags2 |= _safe_flag("EExportFbxOptions2_YUp")
    elif target_upper == "UNITY":
        flags |= _safe_flag("EExportFbxOptions_AutoSkinRigidMesh")
        flags2 |= _safe_flag("EExportFbxOptions2_UnityPreset")
        flags2 |= _safe_flag("EExportFbxOptions2_YUp")
    elif target_upper == "MAYA":
        flags |= _safe_flag("EExportFbxOptions_AutoSkinRigidMesh")
        flags |= _safe_flag("EExportFbxOptions_MayaAdjustMaterial")
    elif flags == 0:
        flags = _safe_flag("EExportFbxOptions_AutoSkinRigidMesh") | _safe_flag("EExportFbxOptions_ExportRootMotion")

    tpose_bit = _safe_flag("EExportFbxOptions_TPoseOnMotionFirstFrame")
    if include_current_pose:
        flags &= ~tpose_bit
    else:
        flags |= tpose_bit

    if delete_hidden_faces:
        flags |= _safe_flag("EExportFbxOptions_RemoveHiddenMesh")
    if remove_eyelash:
        flags |= _safe_flag("EExportFbxOptions_RemoveEyelash")
    if remove_tearline_occlusion:
        flags |= _safe_flag("EExportFbxOptions_RemoveTearLineAndOcclusion")
    if embed_textures:
        flags |= _safe_flag("EExportFbxOptions_EmbedTexture")
    if convert_image_format:
        flags |= _safe_flag("EExportFbxOptions_ConvertTifToPNG")
    if export_json:
        flags3 |= _safe_flag("EExportFbxOptions3_ExportJson")
    if instalod_preset:
        flags2 |= _safe_flag("EExportFbxOptions2_InstaLodPreset")
    if motion_only:
        flags |= _safe_flag("EExportFbxOptions_RemoveAllMesh")
    if include_motion_path:
        if ".." in include_motion_path or not os.path.isfile(include_motion_path):
            return {"success": False, "error": f"Motion file not found: {include_motion_path}"}
        export_motion = True

    applied: dict[str, Any] = {}
    try:
        dir_path = os.path.dirname(output_path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)

        setting = RLPy.RExportFbxSetting()
        setting.SetOption(flags)
        if flags2:
            setting.SetOption2(flags2)
        if flags3:
            setting.SetOption3(flags3)
        if use_smooth_mesh:
            setting.EnableBakeSubdivision(True)
            applied["use_smooth_mesh"] = True
        if sub_d_level is not None:
            setting.SetExportLevel(int(sub_d_level))
            applied["export_level"] = int(sub_d_level)
        setting.EnableExportMotion(bool(export_motion))
        applied["export_motion"] = bool(export_motion)
        if fps is not None:
            fps_attr = getattr(RLPy.RFps, f"Fps{int(fps)}", None) if hasattr(RLPy, "RFps") else None
            if fps_attr is None:
                notes.append(f"WARNING: RLPy.RFps.Fps{int(fps)} not found, fps skipped")
            else:
                setting.SetExportMotionFps(fps_attr)
                applied["fps"] = int(fps)
        if motion_range is not None:
            if isinstance(motion_range, (list, tuple)) and len(motion_range) == 2:
                start_f, end_f = int(motion_range[0]), int(motion_range[1])
                setting.SetExportMotionRange(RLPy.RRangePair(start_f, end_f))
                applied["motion_range"] = [start_f, end_f]
            else:
                notes.append("WARNING: motion_range must be [start, end]; left default (All)")
        if texture_size is not None:
            # SetTextureSize takes EExportTextureSize, whose values equal the pixel size.
            setting.SetTextureSize(int(texture_size))
            applied["texture_size"] = int(texture_size)

        if include_motion_path:
            setting.SetIncludeMotionPath(include_motion_path)
            applied["include_motion_path"] = include_motion_path
        status = RLPy.RFileIO.ExportFbxFile(avatar, output_path, setting)
        if status is not None and hasattr(RLPy, "RStatus") and status != RLPy.RStatus.Success:
            return {"success": False, "error": f"ExportFbxFile returned {status}", "notes": notes}
    except Exception as e:
        return {"success": False, "error": str(e), "notes": notes}

    if not os.path.exists(output_path):
        return {"success": False, "error": f"Export reported success but no file at {output_path}", "notes": notes}

    result: dict[str, Any] = {
        "success": True,
        "path": output_path,
        "size_bytes": os.path.getsize(output_path),
        "flags": flags,
        "flags2": flags2,
        "flags3": flags3,
        "target_tool": target_tool or "default",
        "notes": notes,
    }
    if embed_textures:
        result["embed_textures"] = True
    if convert_image_format:
        result["convert_image_format"] = True
    if export_json:
        result["json_exists"] = os.path.exists(os.path.splitext(output_path)[0] + ".json")
    result.update(applied)
    return result


_FACIAL_PROFILE_NAMES = {
    "EFacialProfile_CC4Extended": "CC4Extended",
    "EFacialProfile_CC4Standard": "CC4Standard",
    "EFacialProfile_Traditional": "Traditional",
    "EFacialProfile__None": "None",
}


def _enum_name(value: Any, names: dict[str, str]) -> str:
    """Map an RLPy enum value back to a readable name (unknown values pass through)."""
    for attr, label in names.items():
        if hasattr(RLPy, attr) and getattr(RLPy, attr) == value:
            return label
    return str(value)


def _facial_profile_type(avatar) -> str | None:
    comp = avatar.GetFacialProfileComponent() if hasattr(avatar, "GetFacialProfileComponent") else None
    if not comp:
        return None
    return _enum_name(comp.GetProfileType(), _FACIAL_PROFILE_NAMES)


def _materials_per_mesh(avatar) -> dict[str, list[str]]:
    mat_comp = avatar.GetMaterialComponent()
    result: dict[str, list[str]] = {}
    if not mat_comp:
        return result
    for mesh in avatar.GetMeshNames(True):
        result[mesh] = list(mat_comp.GetMaterialNames(mesh) or [])
    return result


def get_avatar_info() -> dict[str, Any] | None:
    """Get detailed information about the current avatar.

    Every field is read independently; a field that fails is reported under
    "errors" instead of failing the whole call.
    """
    avatar = get_first_avatar()
    if not avatar:
        return None

    info: dict[str, Any] = {"name": avatar.GetName(), "id": avatar.GetID()}
    errors: dict[str, str] = {}

    def _field(key: str, fn) -> None:
        try:
            info[key] = fn()
        except Exception as e:
            errors[key] = str(e)

    _field("avatar_type", lambda: int(avatar.GetAvatarType()))
    _field("generation", lambda: int(avatar.GetGeneration()))
    _field("facial_profile", lambda: _facial_profile_type(avatar))
    _field("skin_bone_count", lambda: len(avatar.GetSkeletonComponent().GetSkinBones()))
    _field("subdiv_level", lambda: int(avatar.GetSubdivMeshLevel()))

    def _materials() -> dict[str, Any]:
        per_mesh = _materials_per_mesh(avatar)
        return {
            "total": sum(len(v) for v in per_mesh.values()),
            "per_mesh": {k: len(v) for k, v in per_mesh.items()},
        }
    _field("materials", _materials)

    def _items() -> dict[str, list[str]]:
        return {
            "clothes": [c.GetName() for c in avatar.GetClothes()],
            "hair": [h.GetName() for h in avatar.GetHairs()],
            "accessories": [a.GetName() for a in avatar.GetAccessories(True)],
        }
    _field("items", _items)

    def _active_morphs() -> list[dict[str, Any]]:
        shaping_comp = avatar.GetAvatarShapingComponent()
        active: list[dict[str, Any]] = []
        if not shaping_comp:
            return active
        seen: set[str] = set()
        for cat, entries in get_morph_catalog().items():
            for entry in entries:
                if entry["id"] in seen:
                    continue  # the same morph can be listed under several categories
                seen.add(entry["id"])
                weight = shaping_comp.GetShapingMorphWeight(entry["id"])
                if abs(weight) > 1e-6:
                    active.append({
                        "id": entry["id"],
                        "display_name": entry["display_name"],
                        "category": cat,
                        "value": weight,
                    })
        return active
    _field("active_morphs", _active_morphs)

    if errors:
        info["errors"] = errors
    return info


def _set_render_resolution(width: int, height: int) -> None:
    """Set RenderImage output size. The default RenderImage output is uselessly
    small (~100x32), making captures unusable for visual verification. Setting
    RExportImageParameter.kCommon.nOutputSizeWidth/Height fixes it (verified on CC5; CC4 has the same getter).
    """
    try:
        g = RLPy.RGlobal
        if hasattr(g, "GetRenderExportImageParameter") and hasattr(g, "SetRenderExportParameter"):
            p = g.GetRenderExportImageParameter()
            if hasattr(p, "kCommon"):
                p.kCommon.nOutputSizeWidth = max(16, int(width))
                p.kCommon.nOutputSizeHeight = max(16, int(height))
                g.SetRenderExportParameter(p)
    except Exception as e:
        print(f"[CC4 MCP Bridge] _set_render_resolution failed: {e}")


def capture_viewport(output_path: str = "", width: int = 1280, height: int = 720) -> dict[str, Any]:
    """Render the CC4 viewport to a PNG at width x height (default 1280x720).

    RenderImage only. There is intentionally no OS screenshot fallback: a
    screenshot captures whatever window is on top, which is not a render.
    """
    try:
        output_path, _path_error = workspace_path(output_path or "viewport.png", "renders")
        if not _path_error:
            _path_error = _validate_path(output_path, {".png"})
        if _path_error:
            return {"success": False, "error": _path_error}

        dir_path = os.path.dirname(output_path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)

        if os.path.exists(output_path):
            os.remove(output_path)

        _set_render_resolution(width, height)

        try:
            RLPy.RGlobal.RenderImage(output_path)
        except Exception as e:
            print(f"[CC4 MCP Bridge] RenderImage attempt 1 failed: {e}")

        # One retry after forcing a viewport refresh.
        if not os.path.exists(output_path):
            if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
                RLPy.RGlobal.ForceViewportUpdate()
            try:
                RLPy.RGlobal.RenderImage(output_path)
            except Exception as e:
                print(f"[CC4 MCP Bridge] RenderImage attempt 2 failed: {e}")

        if not os.path.exists(output_path):
            return {"success": False, "error": f"RenderImage did not create file at {output_path}"}

        file_size = os.path.getsize(output_path)
        if file_size > MAX_IMAGE_BYTES:
            return {
                "success": True,
                "path": output_path,
                "warning": f"Image too large to embed ({file_size} bytes). Read from path directly.",
            }
        with open(output_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        return {"success": True, "path": output_path, "base64": image_data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Undo / Redo ---

def _active_morph_count() -> int:
    """Count non-zero morph sliders on the current avatar."""
    avatar = get_first_avatar()
    if not avatar:
        return 0
    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return 0
    count = 0
    categories = shaping_comp.GetShapingMorphCatergoryNames()
    for cat in categories:
        ids = shaping_comp.GetShapingMorphIDs(cat)
        for morph_id in ids:
            weight = shaping_comp.GetShapingMorphWeight(morph_id)
            if abs(weight) > 1e-6:
                count += 1
    return count


def undo() -> dict[str, Any]:
    """Undo the last action in CC4."""
    try:
        RLPy.RGlobal.Undo()
        avatar = get_first_avatar()
        if avatar:
            RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
        if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
            RLPy.RGlobal.ForceViewportUpdate()
        return {"success": True, "active_morph_count": _active_morph_count()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def redo() -> dict[str, Any]:
    """Redo the last undone action in CC4."""
    try:
        RLPy.RGlobal.Redo()
        avatar = get_first_avatar()
        if avatar:
            RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
        if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
            RLPy.RGlobal.ForceViewportUpdate()
        return {"success": True, "active_morph_count": _active_morph_count()}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Camera Control ---

def get_camera_info() -> dict[str, Any]:
    """Get current camera position and focal length."""
    camera = RLPy.RScene.GetCurrentCamera()
    if not camera:
        return {"success": False, "error": "No camera"}
    transform = camera.WorldTransform()
    pos = transform.T()
    rot = transform.R()
    focal = camera.GetFocalLength(RLPy.RGlobal.GetTime())
    return {
        "name": camera.GetName(),
        "position": {"x": pos.x, "y": pos.y, "z": pos.z},
        "focal_length": focal,
    }


def set_camera_focal_length(focal_length: float) -> dict[str, Any]:
    """Set the focal length of the current camera.
    Note: the 'Preview Camera' does not support focal length changes via API.
    This works only on user-created cameras.
    """
    camera = RLPy.RScene.GetCurrentCamera()
    if not camera:
        return {"success": False, "error": "No camera"}
    time = RLPy.RGlobal.GetTime()
    before = camera.GetFocalLength(time)
    try:
        RLPy.RGlobal.BeginAction("Set Camera Focal Length")
        camera.SetFocalLength(time, focal_length)
        RLPy.RGlobal.ObjectModified(camera, RLPy.EObjectModifiedType_Attribute)
        if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
            RLPy.RGlobal.ForceViewportUpdate()
    finally:
        RLPy.RGlobal.EndAction()
    actual = camera.GetFocalLength(time)
    if abs(actual - before) < 0.01 and abs(focal_length - before) > 0.01:
        return {
            "success": False,
            "error": f"Camera '{camera.GetName()}' does not support focal length changes (Preview Camera limitation). Create a new camera in CC4 to use this feature.",
            "focal_length": actual,
        }
    return {"success": True, "focal_length": actual}


_CAMERA_VIEWS = {
    "face": "ECameraLocationType_Face",
    "front": "ECameraLocationType_Front",
    "back": "ECameraLocationType_Back",
    "left": "ECameraLocationType_Left",
    "right": "ECameraLocationType_Right",
    "top": "ECameraLocationType_Top",
    "bottom": "ECameraLocationType_Bottom",
    "home": "ECameraLocationType_Home",
    "all": "ECameraLocationType_All",
    "focus": "ECameraLocationType_Focus",
}


def frame_camera(view: str = "face") -> dict[str, Any]:
    """Move the current camera to a preset view (face/front/home/all/back/left/right/top/
    bottom/focus). Enables face-level visual verification (eye/lip/skin color, facial
    morphs) that a full-body shot is too small to show. Found needed via tutorial runs.
    """
    cam = RLPy.RScene.GetCurrentCamera()
    if not cam:
        return {"success": False, "error": "No camera in scene"}
    key = (view or "").strip().lower()
    enum_name = _CAMERA_VIEWS.get(key)
    if not enum_name:
        return {"success": False, "error": f"Unknown view '{view}'. Valid: {', '.join(sorted(_CAMERA_VIEWS))}"}
    loc = getattr(RLPy, enum_name, None)
    if loc is None:
        return {"success": False, "error": f"Camera view '{view}' not available in this CC4 version"}
    try:
        cam.SetCameraLocation(loc)
        if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
            RLPy.RGlobal.ForceViewportUpdate()
        return {"success": True, "view": key, "camera": cam.GetName()}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Light Control ---

def get_lights() -> list[dict[str, Any]]:
    """List all lights in the scene (deduplicated by ID)."""
    seen_ids: set[int] = set()
    result: list[dict[str, Any]] = []
    type_names = {
        RLPy.EObjectType_SpotLight: "SpotLight",
        RLPy.EObjectType_PointLight: "PointLight",
        RLPy.EObjectType_DirectionalLight: "DirectionalLight",
    }
    for light_type, type_name in type_names.items():
        objects = RLPy.RScene.FindObjects(light_type)
        for obj in objects:
            obj_id = obj.GetID()
            if obj_id not in seen_ids:
                seen_ids.add(obj_id)
                result.append({
                    "name": obj.GetName(),
                    "id": obj_id,
                    "type": type_name,
                })
    return result


def set_light_color(light_name: str, r: float, g: float, b: float) -> dict[str, Any]:
    """Set light color by name."""
    # UR-21: use shared _find_light helper to avoid duplicating the type-scan loop
    light, _ = _find_light(light_name)
    if not light:
        return {"success": False, "error": f"Light not found: {light_name}"}
    try:
        RLPy.RGlobal.BeginAction("Set Light Color")
        color = RLPy.RRgb(r, g, b)
        light.SetColor(RLPy.RGlobal.GetTime(), color)
        RLPy.RGlobal.ObjectModified(light, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "light": light_name}


def _find_light(light_name: str):
    """Find a light object by name across all light types. Returns (light, type_name) or (None, None)."""
    for light_type, type_name in [
        (RLPy.EObjectType_SpotLight, "SpotLight"),
        (RLPy.EObjectType_PointLight, "PointLight"),
        (RLPy.EObjectType_DirectionalLight, "DirectionalLight"),
    ]:
        light = RLPy.RScene.FindObject(light_type, light_name)
        if light:
            return light, type_name
    return None, None


def get_light_info(light_name: str) -> dict[str, Any]:
    """Get color and multiplier for a named light."""
    light, type_name = _find_light(light_name)
    if not light:
        return {"success": False, "error": f"Light not found: {light_name}"}

    time = RLPy.RGlobal.GetTime()
    result: dict[str, Any] = {"name": light_name, "type": type_name}
    try:
        color = light.GetColor()
        result["color"] = {"r": color.Red() / 255.0, "g": color.Green() / 255.0, "b": color.Blue() / 255.0}
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_light_info GetColor failed: {e}")
        result["color"] = None
    try:
        result["multiplier"] = light.GetMultiplier()
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_light_info GetMultiplier failed: {e}")
        result["multiplier"] = None
    # Lighting-guide additions: on/off + shadow shaping state (all best-effort)
    try:
        result["active"] = bool(light.GetActive())
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_light_info GetActive failed: {e}")
        result["active"] = None
    try:
        result["cast_shadow"] = bool(light.IsCastShadow())
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_light_info IsCastShadow failed: {e}")
        result["cast_shadow"] = None
    try:
        result["darken_shadow_strength"] = float(light.GetDarkenShadowStrength())
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_light_info GetDarkenShadowStrength failed: {e}")
        result["darken_shadow_strength"] = None
    try:
        result["range"] = float(light.GetRange())
    except Exception:
        # Directional lights have no range — not an error worth logging loudly
        result["range"] = None
    return result


def set_light_multiplier(light_name: str, multiplier: float) -> dict[str, Any]:
    """Set the intensity multiplier of a light by name."""
    if multiplier < 0:
        return {"success": False, "error": "Multiplier must be >= 0"}
    light, _ = _find_light(light_name)
    if not light:
        return {"success": False, "error": f"Light not found: {light_name}"}

    try:
        RLPy.RGlobal.BeginAction("Set Light Multiplier")
        light.SetMultiplier(RLPy.RGlobal.GetTime(), multiplier)
        RLPy.RGlobal.ObjectModified(light, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "light": light_name, "multiplier": multiplier}


def set_light_active(light_name: str, active: bool) -> dict[str, Any]:
    """Turn a light on or off by name (lighting-guide: toggle lights to shape a scene).

    Uses the keyable SetActive(time, bool); reads back GetActive() to confirm.
    """
    light, _ = _find_light(light_name)
    if not light:
        return {"success": False, "error": f"Light not found: {light_name}"}
    active = bool(active)
    try:
        RLPy.RGlobal.BeginAction("Set Light Active")
        light.SetActive(RLPy.RGlobal.GetTime(), active)
        RLPy.RGlobal.ObjectModified(light, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    try:
        confirmed = bool(light.GetActive())
    except Exception:
        confirmed = active
    return {"success": True, "light": light_name, "active": confirmed}


def set_light_shadow(
    light_name: str,
    cast_shadow: bool | None = None,
    darken_strength: float | None = None,
) -> dict[str, Any]:
    """Control a light's shadow casting and darkness (lighting-guide: soften/tune shadows).

    - cast_shadow: enable/disable shadow casting — SetCastShadow(bool), 1-arg.
    - darken_strength: 0.0-1.0 shadow darkness — SetDarkenShadowStrength(time, float), keyable.

    At least one of the two must be provided. Both are applied if given.
    """
    if cast_shadow is None and darken_strength is None:
        return {"success": False, "error": "Provide cast_shadow and/or darken_strength"}
    if darken_strength is not None and not (0.0 <= darken_strength <= 1.0):
        return {"success": False, "error": "darken_strength must be 0.0-1.0"}
    light, _ = _find_light(light_name)
    if not light:
        return {"success": False, "error": f"Light not found: {light_name}"}

    applied: dict[str, Any] = {}
    try:
        RLPy.RGlobal.BeginAction("Set Light Shadow")
        if cast_shadow is not None:
            light.SetCastShadow(bool(cast_shadow))
            applied["cast_shadow"] = bool(cast_shadow)
        if darken_strength is not None:
            light.SetDarkenShadowStrength(RLPy.RGlobal.GetTime(), float(darken_strength))
            applied["darken_shadow_strength"] = float(darken_strength)
        RLPy.RGlobal.ObjectModified(light, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "light": light_name, **applied}


# --- Environment / Visual Settings (ambient + IBL/HDRI) ---

_IBL_EXTENSIONS = {".hdr", ".exr", ".png", ".jpg", ".jpeg", ".hdri"}


def get_visual_settings() -> dict[str, Any]:
    """Get global environment lighting: ambient color (0-1) and IBL/HDRI state."""
    if not hasattr(RLPy.RGlobal, "GetVisualSettingComponent"):
        return {"success": False, "error": "Visual settings not available in this CC4 version"}
    vs = RLPy.RGlobal.GetVisualSettingComponent()
    if not vs:
        return {"success": False, "error": "No visual setting component"}
    result: dict[str, Any] = {"success": True}
    try:
        amb = vs.GetAmbientColor()
        result["ambient"] = {"r": amb.Red() / 255.0, "g": amb.Green() / 255.0, "b": amb.Blue() / 255.0}
    except Exception as e:
        print(f"[CC4 MCP Bridge] get_visual_settings ambient failed: {e}")
        result["ambient"] = None
    try:
        result["ibl_enabled"] = bool(vs.IsIBLEnable())
    except Exception:
        result["ibl_enabled"] = None
    return result


def set_ambient(r: float, g: float, b: float) -> dict[str, Any]:
    """Set the scene ambient (fill) light color. RGB are floats 0.0-1.0."""
    if not hasattr(RLPy.RGlobal, "GetVisualSettingComponent"):
        return {"success": False, "error": "Visual settings not available in this CC4 version"}
    vs = RLPy.RGlobal.GetVisualSettingComponent()
    if not vs:
        return {"success": False, "error": "No visual setting component"}
    r = max(0.0, min(1.0, float(r)))
    g = max(0.0, min(1.0, float(g)))
    b = max(0.0, min(1.0, float(b)))
    try:
        RLPy.RGlobal.BeginAction("Set Ambient Color")
        vs.SetAmbientColor(RLPy.RRgb(r, g, b))
    finally:
        RLPy.RGlobal.EndAction()
    try:
        amb = vs.GetAmbientColor()
        applied = {"r": amb.Red() / 255.0, "g": amb.Green() / 255.0, "b": amb.Blue() / 255.0}
    except Exception:
        applied = {"r": r, "g": g, "b": b}
    return {"success": True, "ambient": applied}


def set_ibl(image_path: str = "", enable: bool = True) -> dict[str, Any]:
    """Enable/disable image-based lighting (IBL/HDRI), optionally loading an HDRI.

    image_path: path to an .hdr/.exr/.png/.jpg environment image. If omitted, only
    the enable flag is toggled (keeping any currently-loaded image).
    """
    if not hasattr(RLPy.RGlobal, "GetVisualSettingComponent"):
        return {"success": False, "error": "Visual settings not available in this CC4 version"}
    vs = RLPy.RGlobal.GetVisualSettingComponent()
    if not vs:
        return {"success": False, "error": "No visual setting component"}

    loaded = None
    if image_path:
        path_error = _validate_path(image_path, _IBL_EXTENSIONS)
        if path_error:
            return {"success": False, "error": path_error}
        if not os.path.isfile(image_path):
            return {"success": False, "error": f"IBL image not found: {image_path}"}
        try:
            RLPy.RGlobal.BeginAction("Load IBL")
            vs.LoadIBLImage(image_path)
            loaded = image_path
        except Exception as e:
            RLPy.RGlobal.EndAction()
            return {"success": False, "error": f"Failed to load IBL image: {e}"}
        else:
            RLPy.RGlobal.EndAction()

    try:
        vs.SetIBLEnable(bool(enable))
    except Exception as e:
        return {"success": False, "error": f"Failed to set IBL enable: {e}"}
    try:
        enabled = bool(vs.IsIBLEnable())
    except Exception:
        enabled = bool(enable)
    return {"success": True, "ibl_enabled": enabled, "loaded_image": loaded}


# --- Expression Control ---

def get_expression_info() -> dict[str, Any]:
    """Get available expression groups and names for the current avatar."""
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar"}
    face_comp = avatar.GetFaceComponent()
    if not face_comp:
        return {"success": False, "error": "No face component"}

    result: dict[str, list[str]] = {}
    try:
        groups = face_comp.GetExpressionGroups()
        for group in groups:
            names = face_comp.GetExpressionNames(group)
            result[group] = list(names) if names else []
    except Exception as e:
        return {"success": False, "error": f"Failed to get expressions: {e}"}

    # Return the bare group->names map (like get_lights/get_avatars). The TS tool
    # (expression.ts) does Object.keys(info); a {success, expressions} wrapper broke it
    # (EXPR-ENVELOPE). Failure paths above still return {success:False} -> HTTP 400.
    return result


def _collect_expression_names(face_comp) -> set[str]:
    """Build the set of all valid expression slider names for the avatar's face."""
    valid: set[str] = set()
    for group in face_comp.GetExpressionGroups():
        names = face_comp.GetExpressionNames(group)
        for n in (names or []):
            valid.add(n)
    return valid


# --- Material / Texture Control ---

def get_material_info(avatar_name: str = "") -> dict[str, Any]:
    """Get mesh names and material names for the current avatar."""
    avatar = get_avatar_by_name(avatar_name)
    if not avatar:
        error = f"Avatar not found: {avatar_name}" if avatar_name else "No avatar in scene"
        return {"success": False, "error": error}

    mat_comp = avatar.GetMaterialComponent()
    if not mat_comp:
        return {"success": False, "error": "No material component"}

    result: dict[str, list[str]] = {}
    try:
        # GetMeshNames is on RIObject (the avatar), not RIMaterialComponent
        meshes = avatar.GetMeshNames(True) if hasattr(avatar, "GetMeshNames") else []
        for mesh in meshes:
            try:
                materials = mat_comp.GetMaterialNames(mesh)
                result[mesh] = list(materials) if materials else []
            except AttributeError:
                result[mesh] = []
            except Exception as e:
                print(f"[CC4 MCP Bridge] GetMaterialNames failed for '{mesh}': {e}")
                result[mesh] = []
    except Exception as e:
        return {"success": False, "error": str(e)}
    return {"success": True, "meshes": result}


MAX_MATERIAL_NAME_LENGTH = 256


def _validate_material_names(mesh_name: str, material_name: str) -> str | None:
    """Validate mesh and material name lengths. Returns error message or None."""
    if len(mesh_name) > MAX_MATERIAL_NAME_LENGTH:
        return f"Mesh name too long ({len(mesh_name)} chars, max {MAX_MATERIAL_NAME_LENGTH})"
    if len(material_name) > MAX_MATERIAL_NAME_LENGTH:
        return f"Material name too long ({len(material_name)} chars, max {MAX_MATERIAL_NAME_LENGTH})"
    return None


def _get_valid_mesh_material(avatar, mesh_name: str, material_name: str) -> tuple[Any, str | None]:
    """Validate mesh/material names exist on the avatar. Returns (mat_comp, error)."""
    mat_comp = avatar.GetMaterialComponent()
    if not mat_comp:
        return None, "No material component"

    # Verify mesh exists
    try:
        meshes = avatar.GetMeshNames(True) if hasattr(avatar, "GetMeshNames") else []
        if meshes and mesh_name not in meshes:
            return None, f"Mesh not found: {mesh_name}. Available: {list(meshes)[:10]}"
    except AttributeError:
        pass  # API not available in this CC4 version
    except Exception as e:
        return None, f"Failed to enumerate meshes: {e}"

    # Verify material exists on this mesh
    try:
        materials = mat_comp.GetMaterialNames(mesh_name)
        if materials and material_name not in materials:
            return None, f"Material not found: {material_name}. Available on '{mesh_name}': {list(materials)[:10]}"
    except AttributeError:
        pass  # API not available
    except Exception as e:
        return None, f"Failed to enumerate materials: {e}"

    return mat_comp, None


def get_diffuse_color(mesh_name: str, material_name: str) -> dict[str, Any]:
    """Get the diffuse color of a material."""
    error = _validate_material_names(mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    mat_comp, error = _get_valid_mesh_material(avatar, mesh_name, material_name)
    if error:
        return {"success": False, "error": error}

    try:
        color = mat_comp.GetDiffuseColor(mesh_name, material_name)
        return {"success": True, "r": color.Red() / 255.0, "g": color.Green() / 255.0, "b": color.Blue() / 255.0}
    except Exception as e:
        return {"success": False, "error": str(e)}


def set_diffuse_color(mesh_name: str, material_name: str, r: float, g: float, b: float) -> dict[str, Any]:
    """Set the diffuse color of a material (for skin tone, clothing color, etc.)."""
    error = _validate_material_names(mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    mat_comp, error = _get_valid_mesh_material(avatar, mesh_name, material_name)
    if error:
        return {"success": False, "error": error}

    try:
        time = RLPy.RGlobal.GetTime()
        key = RLPy.RKey()
        key.SetTime(time)
        r = max(0.0, min(1.0, r))
        g = max(0.0, min(1.0, g))
        b = max(0.0, min(1.0, b))
        color = RLPy.RRgb(r, g, b)
        try:
            RLPy.RGlobal.BeginAction("Set Diffuse Color")
            mat_comp.AddDiffuseKey(key, mesh_name, material_name, color)
            RLPy.RGlobal.ObjectModified(avatar, _EOMTYPE_MATERIAL)
        finally:
            RLPy.RGlobal.EndAction()
        return {"success": True, "mesh": mesh_name, "material": material_name}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- PBR Shader Parameters (Digital Human Shader: roughness, SSS, micronormal) ---

def get_shader_parameters(mesh_name: str, material_name: str) -> dict[str, Any]:
    """Get the shader name and all numeric shader parameters for a material.

    Exposes the Digital Human Shader controls (skin roughness scales, SSS radius/
    falloff/IOR, micronormal strength, specular, etc.). Each value is a list of
    floats (most are length 1). Use set_shader_parameter to change one.
    """
    error = _validate_material_names(mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    mat_comp, error = _get_valid_mesh_material(avatar, mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    if not hasattr(mat_comp, "GetShaderParameterNames"):
        return {"success": False, "error": "Shader parameter API not available in this CC4 build"}

    try:
        shader = mat_comp.GetShader(mesh_name, material_name) if hasattr(mat_comp, "GetShader") else None
        names = mat_comp.GetShaderParameterNames(mesh_name, material_name)
        params: dict[str, list[float]] = {}
        for name in (names or []):
            try:
                value = mat_comp.GetShaderParameter(mesh_name, material_name, name)
                params[name] = [float(v) for v in value]
            except Exception:
                # skip non-numeric / unreadable params rather than failing the whole call
                continue
        return {
            "success": True,
            "mesh": mesh_name,
            "material": material_name,
            "shader": shader,
            "parameters": params,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def set_shader_parameter(
    mesh_name: str, material_name: str, parameter_name: str, values: list[float]
) -> dict[str, Any]:
    """Set a single Digital Human Shader parameter (e.g. 'Micro Roughness Scale',
    'SSS Radius', '_Specular') to a list of float values.

    The parameter name is validated against the material's actual shader parameters
    (use get_shader_parameters to discover them), and the value count must match the
    parameter's existing length — both guard against passing bad data to the SWIG layer.
    """
    error = _validate_material_names(mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    if not parameter_name or not isinstance(parameter_name, str):
        return {"success": False, "error": "parameter_name is required"}
    if not isinstance(values, list) or not values:
        return {"success": False, "error": "values must be a non-empty list of numbers"}
    try:
        values = [float(v) for v in values]
    except (TypeError, ValueError):
        return {"success": False, "error": "values must all be numbers"}

    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    mat_comp, error = _get_valid_mesh_material(avatar, mesh_name, material_name)
    if error:
        return {"success": False, "error": error}
    if not hasattr(mat_comp, "SetShaderParameter"):
        return {"success": False, "error": "Shader parameter API not available in this CC4 build"}

    try:
        valid_names = list(mat_comp.GetShaderParameterNames(mesh_name, material_name) or [])
    except Exception as e:
        return {"success": False, "error": f"Failed to read shader parameters: {e}"}
    if parameter_name not in valid_names:
        return {"success": False, "error": f"Unknown shader parameter: {parameter_name}"}

    # Length must match the existing parameter (passing the wrong arity can crash SWIG)
    try:
        current = list(mat_comp.GetShaderParameter(mesh_name, material_name, parameter_name))
    except Exception as e:
        return {"success": False, "error": f"Failed to read current value: {e}"}
    if len(values) != len(current):
        return {
            "success": False,
            "error": f"'{parameter_name}' expects {len(current)} value(s), got {len(values)}",
        }

    try:
        RLPy.RGlobal.BeginAction("Set Shader Parameter")
        mat_comp.SetShaderParameter(mesh_name, material_name, parameter_name, values)
        RLPy.RGlobal.ObjectModified(avatar, _EOMTYPE_MATERIAL)
    finally:
        RLPy.RGlobal.EndAction()

    try:
        applied = [float(v) for v in mat_comp.GetShaderParameter(mesh_name, material_name, parameter_name)]
    except Exception:
        applied = values
    return {
        "success": True,
        "mesh": mesh_name,
        "material": material_name,
        "parameter": parameter_name,
        "values": applied,
    }


# --- Content Management (Clothes, Hair, Accessories) ---

def list_clothes() -> list[dict[str, Any]]:
    """List all clothing items on the current avatar."""
    avatar = get_first_avatar()
    if not avatar:
        return []
    try:
        clothes = avatar.GetClothes()
        return [
            {
                "name": c.GetName(),
                "id": c.GetID(),
                "type": str(c.GetClotheType()) if hasattr(c, "GetClotheType") else "unknown",
            }
            for c in clothes
        ]
    except Exception as e:
        print(f"[CC4 MCP Bridge] list_clothes failed: {e}")
        return []


def list_hair() -> list[dict[str, Any]]:
    """List all hair items on the current avatar."""
    avatar = get_first_avatar()
    if not avatar:
        return []
    try:
        hairs = avatar.GetHairs()
        return [
            {
                "name": h.GetName(),
                "id": h.GetID(),
                "type": str(h.GetHairType()) if hasattr(h, "GetHairType") else "unknown",
            }
            for h in hairs
        ]
    except Exception as e:
        print(f"[CC4 MCP Bridge] list_hair failed: {e}")
        return []


def list_accessories() -> list[dict[str, Any]]:
    """List all accessories on the current avatar."""
    avatar = get_first_avatar()
    if not avatar:
        return []
    try:
        accessories = avatar.GetAccessories(True)
        return [
            {"name": a.GetName(), "id": a.GetID()}
            for a in accessories
        ]
    except Exception as e:
        print(f"[CC4 MCP Bridge] list_accessories failed: {e}")
        return []


MAX_ITEM_NAME_LENGTH = 256


def remove_scene_item(item_name: str) -> dict[str, Any]:
    """Remove a clothing, hair, or accessory item by name."""
    if not item_name or len(item_name) > MAX_ITEM_NAME_LENGTH:
        return {"success": False, "error": "Invalid item name"}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    getters = [
        avatar.GetClothes,
        avatar.GetHairs,
        lambda: avatar.GetAccessories(True),
    ]
    for getter in getters:
        try:
            items = getter()
            for item in items:
                if item.GetName() == item_name:
                    RLPy.RGlobal.BeginAction("Remove Item")
                    try:
                        RLPy.RScene.RemoveObject(item)
                        RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
                        if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
                            RLPy.RGlobal.ForceViewportUpdate()
                    finally:
                        RLPy.RGlobal.EndAction()
                    return {"success": True, "removed": item_name}
        except Exception as e:
            print(f"[CC4 MCP Bridge] remove_scene_item getter failed: {e}")
    return {"success": False, "error": f"Item not found: {item_name}"}


def browse_content(folder_type: str = "cloth_upper") -> list[str]:
    """Browse available content files by category. Returns file paths.

    We resolve a '$/...' folder string via
    RApplication.GetDefaultContentFolder(enum) (falling back to
    GetCustomContentFolder) and then list files with
    RApplication.GetContentFilesInFolder(folderString). The enum is NEVER passed
    to GetContentFilesInFolder (that raises a SWIG std::wstring TypeError).
    """
    # Map advertised folder-type keys to EContentRootFolder enum names (all present
    # in CC4 4.70's RLPy.py).
    # Only enums that actually exist in this build are kept (hasattr-guarded below).
    enum_candidates = {
        "cloth_upper": "EContentRootFolder_Upper",
        "cloth_lower": "EContentRootFolder_Lower",
        "shoes": "EContentRootFolder_Shoes",
        # No _AccessoryHead / _AccessoryBody enum exists — both map to the only
        # accessory folder enum.
        "accessory_head": "EContentRootFolder_AccessoryOthers",
        "accessory_body": "EContentRootFolder_AccessoryOthers",
        # 'cloth' is an alias for the full-body clothing folder.
        "cloth": "EContentRootFolder_FullBody",
        # Animation / scene content (.cc*/.i*/.rl*).
        # pose/motion may be empty on a base install (no pose packs) but resolve
        # correctly and will list files once content is installed.
        "pose": "EContentRootFolder_Pose",
        "motion": "EContentRootFolder_Motion",
        "expression": "EContentRootFolder_Expression",
        "props": "EContentRootFolder_Props",
        "light": "EContentRootFolder_Light",
        "camera": "EContentRootFolder_Camera",
        "character": "EContentRootFolder_Character",
        "project": "EContentRootFolder_Project",
        "gloves": "EContentRootFolder_Gloves",
        "skin": "EContentRootFolder_FullSkin",
        "skin_head": "EContentRootFolder_Skin_Head",
    }
    folder_map: dict[str, Any] = {}
    for key, attr_name in enum_candidates.items():
        if hasattr(RLPy, attr_name):
            folder_map[key] = getattr(RLPy, attr_name)

    if folder_type not in folder_map:
        available = list(folder_map.keys()) if folder_map else list(enum_candidates.keys())
        return [f"Unknown folder type: {folder_type}. Available: {', '.join(available)}"]

    if not hasattr(RLPy, "RApplication") or not hasattr(RLPy.RApplication, "GetContentFilesInFolder"):
        return [f"Content browsing not available for '{folder_type}' in this CC4 version"]

    try:
        root_folder = folder_map[folder_type]

        # Collect candidate '$/...' folder STRINGS: bundled templates + user custom.
        # (Never pass the enum to GetContentFilesInFolder — it expects the string.)
        folder_strs: list[str] = []
        for getter in ("GetDefaultContentFolder", "GetCustomContentFolder"):
            if hasattr(RLPy.RApplication, getter):
                try:
                    fs = getattr(RLPy.RApplication, getter)(root_folder)
                    if fs:
                        folder_strs.append(fs)
                except Exception:
                    pass

        if not folder_strs:
            return [f"No content folder resolved for '{folder_type}'"]

        # CC content files use .cc* extensions (e.g. .ccCloth, .ccAvatar);
        # legacy CC3/iClone content uses .i* (e.g. .iAvatar, .iShoe). Accept both.
        results: list[str] = []
        seen: set[str] = set()
        for fs in folder_strs:
            try:
                files = RLPy.RApplication.GetContentFilesInFolder(fs)
            except Exception:
                files = None
            for f in (files or []):
                ext = os.path.splitext(f)[1].lower()
                if (ext.startswith(".cc") or ext.startswith(".i")) and f not in seen:
                    seen.add(f)
                    results.append(f)
                    if len(results) >= 200:
                        return results
        return results
    except Exception as e:
        return [f"Error browsing content: {e}"]


# --- Convenience Color Shortcuts ---

# Known mesh/material names for CC standard avatars
_EYE_TARGETS = [
    ("CC_Base_Eye", "Std_Eye_R"),
    ("CC_Base_Eye", "Std_Eye_L"),
    ("CC_Base_Eye", "Eye_R"),
    ("CC_Base_Eye", "Eye_L"),
]

_HAIR_MESH_PREFIXES = ["CC_Base_Hair", "Hair", "hair"]


def _find_materials_by_prefix(avatar, mesh_prefixes: list[str]) -> list[tuple[str, str, Any]]:
    """Find all mesh/material pairs where mesh name starts with one of the prefixes."""
    mat_comp = avatar.GetMaterialComponent()
    if not mat_comp:
        return []
    results: list[tuple[str, str, Any]] = []
    try:
        meshes = avatar.GetMeshNames(True) if hasattr(avatar, "GetMeshNames") else []
        for mesh in meshes:
            for prefix in mesh_prefixes:
                if mesh.startswith(prefix) or mesh.lower().startswith(prefix.lower()):
                    try:
                        materials = mat_comp.GetMaterialNames(mesh)
                        for mat_name in (materials or []):
                            results.append((mesh, mat_name, mat_comp))
                    except Exception as e:
                        print(f"[CC4 MCP Bridge] _find_materials_by_prefix GetMaterialNames failed: {e}")
                    break
    except Exception as e:
        print(f"[CC4 MCP Bridge] _find_materials_by_prefix GetMeshNames failed: {e}")
    return results


def _apply_diffuse_color_to_targets(
    mat_comp: Any,
    targets: list[tuple[str, str]],
    key: Any,
    color: Any,
) -> list[str]:
    """Apply diffuse color to a list of (mesh, material) pairs. Returns applied labels."""
    applied: list[str] = []
    for mesh_name, material_name in targets:
        try:
            mat_comp.AddDiffuseKey(key, mesh_name, material_name, color)
            applied.append(f"{mesh_name}/{material_name}")
        except Exception as e:
            print(f"[CC4 MCP Bridge] AddDiffuseKey failed for {mesh_name}/{material_name}: {e}")
    return applied

def set_eye_color(r: float, g: float, b: float) -> dict[str, Any]:
    """Set eye color (convenience shortcut). RGB 0.0-1.0."""
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    mat_comp = avatar.GetMaterialComponent()
    if not mat_comp:
        return {"success": False, "error": "No material component"}
    r = max(0.0, min(1.0, r))
    g = max(0.0, min(1.0, g))
    b = max(0.0, min(1.0, b))
    color = RLPy.RRgb(r, g, b)
    time = RLPy.RGlobal.GetTime()
    key = RLPy.RKey()
    key.SetTime(time)
    applied: list[str] = []
    try:
        RLPy.RGlobal.BeginAction("Set Eye Color")
        applied = _apply_diffuse_color_to_targets(mat_comp, _EYE_TARGETS, key, color)
        if applied:
            RLPy.RGlobal.ObjectModified(avatar, _EOMTYPE_MATERIAL)
    finally:
        RLPy.RGlobal.EndAction()
    if applied:
        return {"success": True, "applied_to": applied}
    return {"success": False, "error": "Could not find eye materials. Use get_material_info to discover mesh/material names."}


def set_hair_color(r: float, g: float, b: float) -> dict[str, Any]:
    """Set hair color on all hair materials (convenience shortcut). RGB 0.0-1.0."""
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}

    r = max(0.0, min(1.0, r))
    g = max(0.0, min(1.0, g))
    b = max(0.0, min(1.0, b))
    color = RLPy.RRgb(r, g, b)
    time = RLPy.RGlobal.GetTime()
    key = RLPy.RKey()
    key.SetTime(time)

    targets = _find_materials_by_prefix(avatar, _HAIR_MESH_PREFIXES)
    # Also check hair items directly
    try:
        hairs = avatar.GetHairs()
        for hair_item in hairs:
            hair_mat_comp = hair_item.GetMaterialComponent() if hasattr(hair_item, "GetMaterialComponent") else None
            if hair_mat_comp:
                try:
                    hair_meshes = hair_item.GetMeshNames(True) if hasattr(hair_item, "GetMeshNames") else []
                    for hm in hair_meshes:
                        try:
                            mats = hair_mat_comp.GetMaterialNames(hm)
                            for mat_name in (mats or []):
                                targets.append((hm, mat_name, hair_mat_comp))
                        except Exception:
                            pass
                except Exception:
                    pass
    except Exception:
        pass

    applied: list[str] = []
    try:
        RLPy.RGlobal.BeginAction("Set Hair Color")
        for mesh_name, material_name, mat_comp in targets:
            try:
                mat_comp.AddDiffuseKey(key, mesh_name, material_name, color)
                applied.append(f"{mesh_name}/{material_name}")
            except Exception as e:
                print(f"[CC4 MCP Bridge] AddDiffuseKey failed for {mesh_name}/{material_name}: {e}")
        if applied:
            RLPy.RGlobal.ObjectModified(avatar, _EOMTYPE_MATERIAL)
    finally:
        RLPy.RGlobal.EndAction()

    if applied:
        return {"success": True, "applied_to": applied}
    return {"success": False, "error": "Could not find hair materials. Use get_material_info to discover mesh/material names."}


# --- Reset Morphs ---

def reset_all_morphs(avatar_name: str = "") -> dict[str, Any]:
    """Reset all morph sliders to zero for an avatar."""
    avatar = get_avatar_by_name(avatar_name)
    if not avatar:
        error = f"Avatar not found: {avatar_name}" if avatar_name else "No avatar in scene"
        return {"success": False, "error": error}
    shaping_comp = avatar.GetAvatarShapingComponent()
    if not shaping_comp:
        return {"success": False, "error": "No shaping component"}
    categories = shaping_comp.GetShapingMorphCatergoryNames()
    count = 0
    try:
        RLPy.RGlobal.BeginAction("Reset All Morphs")
        for cat in categories:
            ids = shaping_comp.GetShapingMorphIDs(cat)
            for morph_id in ids:
                weight = shaping_comp.GetShapingMorphWeight(morph_id)
                if abs(weight) > 1e-6:
                    shaping_comp.SetShapingMorphWeight(morph_id, 0.0)
                    count += 1
        RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "reset_count": count}


# --- Pipeline actions (Phase 2: S1 author, S2 optimize, S3 export) ---
#
# Facts these rely on are in docs/spikes.md.

import math

MORPH_HARD_LIMIT = 1.0  # values outside [-1, 1] are clamped (SWIG safety)


def _norm_path(path: str) -> str:
    return os.path.normcase(os.path.realpath(path))


def current_project_path() -> str:
    return RLPy.RApplication.GetCurrentProjectPath() or ""


def _ok(status: Any) -> bool:
    return status is None or not hasattr(RLPy, "RStatus") or status == RLPy.RStatus.Success


def morph_catalog_status() -> dict[str, Any]:
    """Whether the shaping catalog is fully bound.

    Spike 0: an avatar loaded too soon after CC4 starts exposes only the
    "Actor Parts" categories; reloading the avatar fixes it.
    """
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    _invalidate_caches()
    catalog = get_morph_catalog()
    full = [c for c in catalog if not c.startswith("Actor Parts")]
    return {
        "ready": bool(full),
        "categories": len(catalog),
        "morphs": sum(len(v) for v in catalog.values()),
    }


def _morph_index() -> dict[str, dict[str, Any]]:
    """id -> {display_name, categories[]} over the whole catalog."""
    index: dict[str, dict[str, Any]] = {}
    for cat, entries in get_morph_catalog().items():
        for e in entries:
            slot = index.setdefault(e["id"], {"display_name": e["display_name"], "categories": []})
            slot["categories"].append(cat)
    return index


def _minmax(shaping, morph_id: str) -> tuple[float, float]:
    pair = shaping.GetShapingMorphMinMax(morph_id)
    # Never iterate FloatPair (see .claude/rules/cc4-dev.md).
    return float(pair.first), float(pair.second)


def search_morphs_v2(query: str, category: str = "", limit: int = 25) -> Any:
    """Search shaping morphs by display name (then ID). Ranked: exact, prefix, substring."""
    q = (query or "").strip().lower()
    if not q:
        return {"success": False, "error": "query is required"}
    limit = max(1, min(int(limit), MAX_SEARCH_RESULTS))
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    shaping = avatar.GetAvatarShapingComponent()
    ranked: list[tuple[int, str, str, str]] = []
    for morph_id, info in _morph_index().items():
        cats = info["categories"]
        if category and not any(c.lower().startswith(category.lower()) for c in cats):
            continue
        name = info["display_name"].lower()
        if name == q:
            rank = 0
        elif name.startswith(q):
            rank = 1
        elif q in name:
            rank = 2
        elif q in morph_id.lower():
            rank = 3
        else:
            continue
        ranked.append((rank, info["display_name"], morph_id, cats[0]))
    ranked.sort()
    results = []
    for _rank, name, morph_id, cat in ranked[:limit]:
        lo, hi = _minmax(shaping, morph_id)
        results.append({"id": morph_id, "display_name": name, "category": cat, "min": lo, "max": hi})
    return {"results": results, "total_matches": len(ranked)}


def set_morphs(entries: list) -> dict[str, Any]:
    """Set shaping morphs by display name or ID in ONE undoable action.

    Every entry is resolved before anything is applied; an unknown or ambiguous
    name fails the whole call. Values are clamped to [-1, 1]. GetShapingMorphMinMax
    is only the UI default range (spike 0: not enforced), so values outside it are
    applied with a warning instead of being clamped.
    """
    if not isinstance(entries, list) or not entries:
        return {"success": False, "error": "morphs must be a non-empty list"}
    if len(entries) > MAX_MORPH_BATCH:
        return {"success": False, "error": f"Too many morphs: {len(entries)}, max {MAX_MORPH_BATCH}"}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    status = morph_catalog_status()
    if not status.get("ready"):
        return {"success": False, "error": "Morph catalog not ready (only 'Actor Parts' bound). "
                                           "Reload the base avatar, then retry.", "catalog": status}
    shaping = avatar.GetAvatarShapingComponent()
    index = _morph_index()
    by_name: dict[str, list[str]] = {}
    for morph_id, info in index.items():
        by_name.setdefault(info["display_name"].lower(), []).append(morph_id)

    errors: list[dict[str, Any]] = []
    resolved: list[tuple[str, float, dict[str, Any]]] = []
    seen: set[str] = set()
    for i, e in enumerate(entries):
        if not isinstance(e, dict) or "value" not in e:
            errors.append({"index": i, "error": "entry needs 'value' and 'display_name' or 'id'"})
            continue
        try:
            value = float(e["value"])
        except (TypeError, ValueError):
            errors.append({"index": i, "error": "value must be a number"})
            continue
        morph_id = e.get("id")
        name = e.get("display_name")
        if morph_id:
            if morph_id not in index:
                errors.append({"index": i, "id": morph_id, "error": "unknown morph ID"})
                continue
        elif name:
            candidates = by_name.get(str(name).lower(), [])
            cat = e.get("category")
            if cat:
                candidates = [c for c in candidates if any(k.lower().startswith(cat.lower()) for k in index[c]["categories"])]
            if not candidates:
                errors.append({"index": i, "display_name": name, "error": "unknown display name"})
                continue
            if len(candidates) > 1:
                errors.append({"index": i, "display_name": name, "error": "ambiguous display name; add 'category' or use 'id'",
                               "candidates": [{"id": c, "categories": index[c]["categories"]} for c in candidates]})
                continue
            morph_id = candidates[0]
        else:
            errors.append({"index": i, "error": "entry needs 'display_name' or 'id'"})
            continue
        if morph_id in seen:
            errors.append({"index": i, "id": morph_id, "error": "duplicate morph in batch"})
            continue
        seen.add(morph_id)
        info: dict[str, Any] = {"id": morph_id, "display_name": index[morph_id]["display_name"], "requested": value}
        clamped = max(-MORPH_HARD_LIMIT, min(MORPH_HARD_LIMIT, value))
        if clamped != value:
            info["warning"] = f"clamped to {clamped} (hard limit ±{MORPH_HARD_LIMIT})"
        lo, hi = _minmax(shaping, morph_id)
        if not lo <= clamped <= hi:
            info["warning"] = (info.get("warning", "") + "; " if "warning" in info else "") + \
                f"outside the UI default range [{lo}, {hi}] (applied anyway)"
        resolved.append((morph_id, clamped, info))

    if errors:
        return {"success": False, "error": f"{len(errors)} morph entr{'y' if len(errors) == 1 else 'ies'} could not be resolved; nothing applied",
                "problems": errors}

    applied = []
    try:
        RLPy.RGlobal.BeginAction("Set Morphs")
        for morph_id, value, info in resolved:
            shaping.SetShapingMorphWeight(morph_id, value)
            info["value"] = float(shaping.GetShapingMorphWeight(morph_id))
            applied.append(info)
        RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Attribute)
    finally:
        RLPy.RGlobal.EndAction()
    return {"success": True, "applied": applied}


_ITEM_EXTENSIONS = (".ccavatar", ".ccproject", ".cccloth", ".ccshoes", ".ccacc", ".ccaccessory", ".cchair",
                    ".rlhair", ".rlhairstyle", ".ccskin", ".ccavatarpreset", ".iavatar", ".iclothes", ".ihair",
                    ".iaccessory", ".ishoe", ".iskin")


def _item_names(avatar) -> dict[str, list[str]]:
    return {
        "clothes": [c.GetName() for c in avatar.GetClothes()],
        "hair": [h.GetName() for h in avatar.GetHairs()],
        "accessories": [a.GetName() for a in avatar.GetAccessories(True)],
    }


def list_items() -> Any:
    """Clothes, hair and accessories on the current avatar, with their scene mesh names."""
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    out: dict[str, list[dict[str, Any]]] = {}
    for label, getter in (("clothes", avatar.GetClothes), ("hair", avatar.GetHairs),
                          ("accessories", lambda: avatar.GetAccessories(True))):
        out[label] = []
        for obj in getter():
            entry: dict[str, Any] = {"name": obj.GetName()}
            try:
                entry["meshes"] = list(obj.GetMeshNames(True))
            except Exception:
                entry["meshes"] = []
            out[label].append(entry)
    return {"avatar": avatar.GetName(), **out}


def load_item(file_path: str) -> dict[str, Any]:
    """Load a content file (base avatar, clothing, hair, accessory, skin, project).

    Path allowlisting (assets/allowlist.json) is enforced by the MCP server
    before this is called; this only checks path safety and existence.
    """
    decoded = urllib.parse.unquote(file_path)
    if "\x00" in decoded or ".." in decoded:
        return {"success": False, "error": "Unsafe path"}
    if not file_path.lower().endswith(_ITEM_EXTENSIONS):
        return {"success": False, "error": f"Unsupported item type: {os.path.splitext(file_path)[1]}"}
    if not os.path.isfile(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}
    avatar = get_first_avatar()
    before = _item_names(avatar) if avatar else {}
    t0 = time.time()
    status = RLPy.RFileIO.LoadFile(file_path)
    seconds = round(time.time() - t0, 2)
    _invalidate_caches()
    avatar = get_first_avatar()
    after = _item_names(avatar) if avatar else {}
    added = {k: [n for n in after.get(k, []) if n not in before.get(k, [])] for k in after}
    return {"success": _ok(status), "path": file_path, "seconds": seconds,
            "avatar": avatar.GetName() if avatar else None, "added": added}


def set_color(target: str, r: float, g: float, b: float) -> Any:
    t = (target or "").lower()
    if t in ("eye", "eyes"):
        return set_eye_color(r, g, b)
    if t == "hair":
        return set_hair_color(r, g, b)
    return {"success": False, "error": "target must be 'eyes' or 'hair'"}


def save_project_as(path: str) -> dict[str, Any]:
    """Save the current project to a new .ccProject; that copy becomes the current project."""
    path, path_error = workspace_path(path, "projects")
    if path_error:
        return {"success": False, "error": path_error}
    if not path.lower().endswith(".ccproject"):
        path += ".ccProject"
    if os.path.exists(path):
        return {"success": False, "error": f"Refusing to overwrite existing project: {path}"}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    before = current_project_path()
    t0 = time.time()
    status = RLPy.RFileIO.SaveProject(path)
    seconds = round(time.time() - t0, 2)
    after = current_project_path()
    if not (_ok(status) and os.path.exists(path)):
        return {"success": False, "error": f"SaveProject failed ({status})", "path": path}
    bridge_state.saved_as_paths.add(_norm_path(path))
    return {"success": True, "path": path, "seconds": seconds, "previous_project": before,
            "current_project": after, "is_current": _norm_path(after) == _norm_path(path) if after else False,
            "size_bytes": os.path.getsize(path)}


def _require_saved_copy() -> str | None:
    current = current_project_path()
    if not current or _norm_path(current) not in bridge_state.saved_as_paths:
        return (f"Refusing: the current project ('{current or 'unsaved'}') was not created by save_project_as "
                "in this CC4 session. Run save_project_as first (design D6: irreversible operations only on copies).")
    return None


_LOD_LEVELS = {"actorbuild": "EConvertCharacterLevel_ActorBuild", "lod1": "EConvertCharacterLevel_LOD1",
               "lod2": "EConvertCharacterLevel_LOD2"}
_CONVERTED_GENERATIONS = {6, 10}  # observed after ActorBUILD (6) and LOD1/LOD2 (10), spikes 3/6


def _avatar_summary(avatar) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for key, fn in (
        ("generation", lambda: int(avatar.GetGeneration())),
        ("skin_bones", lambda: len(avatar.GetSkeletonComponent().GetSkinBones())),
        ("materials", lambda: {k: len(v) for k, v in _materials_per_mesh(avatar).items()}),
        ("visemes", lambda: len(list(avatar.GetVisemeComponent().GetVisemeNames() or []))),
    ):
        try:
            summary[key] = fn()
        except Exception as e:
            summary[key + "_error"] = str(e)
    return summary


def convert_lod(level: str, bake_expression: bool = True) -> dict[str, Any]:
    """ActorBUILD / LOD1 / LOD2 conversion (irreversible) on a saved copy.

    CC4 shows two confirmation dialogs; the job stays 'running' until a human clicks OK.
    """
    guard = _require_saved_copy()
    if guard:
        return {"success": False, "error": guard}
    enum_name = _LOD_LEVELS.get((level or "").lower())
    if not enum_name:
        return {"success": False, "error": f"level must be one of {sorted(_LOD_LEVELS)}"}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    if int(avatar.GetGeneration()) in _CONVERTED_GENERATIONS:
        return {"success": False, "error": "This avatar is already converted. Reload the authored base, save_project_as a new copy, then convert."}
    before = _avatar_summary(avatar)
    t0 = time.time()
    status = avatar.ConvertTo(getattr(RLPy, enum_name), bool(bake_expression), True,
                              RLPy.EReduceBonePose_Default)
    seconds = round(time.time() - t0, 2)
    _invalidate_caches()
    avatar = get_first_avatar()
    return {"success": _ok(status), "level": level.lower(), "seconds_including_dialogs": seconds,
            "project": current_project_path(), "before": before,
            "after": _avatar_summary(avatar) if avatar else None}


def merge_materials(mesh_names: list | None = None, texture_size: int = 1024) -> dict[str, Any]:
    """Merge materials of clothing/accessory meshes into one atlas (MergeMaterialUV, spike 9).

    Defaults to every clothing + accessory mesh. The body/game body is refused
    (per-region skin materials and SALSA binding are an M2 decision).
    """
    guard = _require_saved_copy()
    if guard:
        return {"success": False, "error": guard}
    if int(texture_size) not in (256, 512, 1024, 2048, 4096):
        return {"success": False, "error": "texture_size must be 256, 512, 1024, 2048 or 4096"}
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    if not mesh_names:
        mesh_names = []
        for obj in list(avatar.GetClothes()) + list(avatar.GetAccessories(True)):
            mesh_names.extend(obj.GetMeshNames(True))
    protected = [m for m in mesh_names if m.startswith(("CC_Base_", "CC_Game_"))]
    if protected:
        return {"success": False, "error": f"Refusing to merge base meshes: {protected}"}
    known = set(avatar.GetMeshNames(True))
    unknown = [m for m in mesh_names if m not in known]
    if unknown or len(mesh_names) < 2:
        return {"success": False, "error": f"Need at least two known meshes; unknown: {unknown}", "available": sorted(known)}
    before = _materials_per_mesh(avatar)
    t0 = time.time()
    status = avatar.GetMaterialComponent().MergeMaterialUV(list(mesh_names), int(texture_size),
                                                           RLPy.EExportTextureFormat_Png, 2)
    after = _materials_per_mesh(get_first_avatar())
    return {"success": _ok(status), "seconds": round(time.time() - t0, 2), "meshes": mesh_names,
            "unique_materials_before": len({m for v in before.values() for m in v}),
            "unique_materials_after": len({m for v in after.values() for m in v}),
            "merged_material": sorted({m for k in mesh_names for m in after.get(k, [])})}


def check_export_license(item: str = "") -> dict[str, Any]:
    """RFileIO.CheckExportFbxHasLicense for the avatar ('' / 'avatar') or a named item."""
    avatar = get_first_avatar()
    if not avatar:
        return {"success": False, "error": "No avatar in scene"}
    fn = RLPy.RFileIO.CheckExportFbxHasLicense
    if not item or item.lower() == "avatar":
        return {"item": avatar.GetName(), "exportable": bool(fn(avatar))}
    for obj in list(avatar.GetClothes()) + list(avatar.GetHairs()) + list(avatar.GetAccessories(True)):
        if obj.GetName() == item:
            return {"item": item, "exportable": bool(fn(obj))}
    return {"success": False, "error": f"Item not found on avatar: {item}"}


# --- capture_views ---

_VIEW_PRESETS = {"full": "ECameraLocationType_Front", "head": "ECameraLocationType_Face",
                 "three_quarter": "ECameraLocationType_Front"}
THREE_QUARTER_DEG = 35.0


def _up_axis(avatar) -> tuple:
    mx, center, mn = RLPy.RVector3(), RLPy.RVector3(), RLPy.RVector3()
    avatar.GetBounds(mx, center, mn)
    extents = [mx.x - mn.x, mx.y - mn.y, mx.z - mn.z]
    return extents.index(max(extents)), center


def _turn_avatar(avatar, degrees: float):
    """Rotate the avatar about its vertical axis for a three-quarter shot.

    The preview camera has no Transform control in CC4 4.70, so the subject
    turns instead of the camera orbiting. Returns the original transform so
    the caller can restore it.
    """
    axis_index, _center = _up_axis(avatar)
    axis = RLPy.RVector3(*[1.0 if i == axis_index else 0.0 for i in range(3)])
    ctrl = avatar.GetControl("Transform")
    if ctrl is None:
        raise RuntimeError("avatar has no Transform control")
    now = RLPy.RGlobal.GetTime()
    original = RLPy.RTransform()
    ctrl.GetValue(now, original)
    q = RLPy.RQuaternion(axis, math.radians(degrees))
    ctrl.SetValue(now, RLPy.RTransform(original.S(), q.Multiply(original.R()), original.T()))
    RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Transform)
    return ctrl, now, RLPy.RTransform(original)


def capture_views(presets: list | None = None, width: int = 1280, height: int = 720,
                  output_dir: str = "", prefix: str = "view") -> dict[str, Any]:
    """Render framed review views (Gate 1): full body, head close-up, three-quarter."""
    presets = presets or ["full", "head", "three_quarter"]
    bad = [p for p in presets if p not in _VIEW_PRESETS]
    if bad:
        return {"success": False, "error": f"Unknown presets {bad}; valid: {sorted(_VIEW_PRESETS)}"}
    if not prefix.replace("-", "").replace("_", "").isalnum():
        return {"success": False, "error": "prefix must be alphanumeric (plus - and _)"}
    avatar = get_first_avatar()
    cam = RLPy.RScene.GetCurrentCamera()
    if not avatar or not cam:
        return {"success": False, "error": "Need an avatar and a camera"}
    # Camera presets frame the SELECTED object: after apply_recipe the last loaded
    # item (e.g. shoes) is selected, which framed only the feet (Phase 3 E2E).
    RLPy.RScene.SelectObject(avatar)
    out_dir = output_dir or character_dir("renders")
    if not _is_within(out_dir, WORKSPACE_ROOT):
        return {"success": False, "error": f"Refusing to write outside the workspace ({WORKSPACE_ROOT}): {out_dir}"}
    views = []
    for preset in presets:
        entry: dict[str, Any] = {"preset": preset}
        try:
            restore = None
            if preset == "three_quarter":
                restore = _turn_avatar(avatar, THREE_QUARTER_DEG)
                entry["method"] = f"avatar turned {THREE_QUARTER_DEG:g} degrees, then restored"
            try:
                cam.SetCameraLocation(getattr(RLPy, _VIEW_PRESETS[preset]))
                if hasattr(RLPy.RGlobal, "ForceViewportUpdate"):
                    RLPy.RGlobal.ForceViewportUpdate()
                shot = capture_viewport(os.path.join(out_dir, f"{prefix}_{preset}.png"), width, height)
            finally:
                if restore is not None:
                    ctrl, now, original = restore
                    ctrl.SetValue(now, original)
                    RLPy.RGlobal.ObjectModified(avatar, RLPy.EObjectModifiedType_Transform)
            entry.update({k: v for k, v in shot.items() if k != "success"})
            entry["success"] = bool(shot.get("success"))
        except Exception as e:
            entry.update({"success": False, "error": str(e)})
        views.append(entry)
    return {"success": all(v["success"] for v in views), "views": views}


# --- Diagnostics (fixed allowlist of read-only introspection queries) ---
#
# Replaces the old exec_python endpoint. Every query only reads: dir(), __doc__,
# enum values, or RLPy getters. Nothing here mutates the scene or runs caller code.

MAX_DIAG_RESULTS = 500
_DIAG_OBJECT_GETTERS = {
    # name -> function(avatar) returning an RLPy object whose methods can be listed
    "avatar": lambda a: a,
    "shaping": lambda a: a.GetAvatarShapingComponent(),
    "facial_profile": lambda a: a.GetFacialProfileComponent(),
    "face": lambda a: a.GetFaceComponent(),
    "viseme": lambda a: a.GetVisemeComponent(),
    "skeleton": lambda a: a.GetSkeletonComponent(),
    "material": lambda a: a.GetMaterialComponent(),
    "morph": lambda a: a.GetMorphComponent(),
    "physics": lambda a: a.GetPhysicsComponent(),
}


def _public_names(obj: Any) -> list[str]:
    return sorted(n for n in dir(obj) if not n.startswith("_") and n not in ("this", "thisown"))


def _diag_symbol_search(arg: str) -> Any:
    if not arg:
        return {"success": False, "error": "symbol_search needs 'arg' (substring)"}
    needle = arg.lower()
    hits = [n for n in dir(RLPy) if needle in n.lower()]
    return {"count": len(hits), "symbols": hits[:MAX_DIAG_RESULTS]}


def _diag_method_list(arg: str) -> Any:
    """Methods of an RLPy class by name, or of a live avatar component by alias."""
    if arg in _DIAG_OBJECT_GETTERS:
        avatar = get_first_avatar()
        if not avatar:
            return {"success": False, "error": "No avatar in scene"}
        obj = _DIAG_OBJECT_GETTERS[arg](avatar)
        if obj is None:
            return {"success": False, "error": f"Component '{arg}' unavailable on this avatar"}
        return {"object": arg, "methods": _public_names(obj)}
    cls = getattr(RLPy, arg, None) if arg and not arg.startswith("_") else None
    if not isinstance(cls, type):
        return {
            "success": False,
            "error": f"'{arg}' is not an RLPy class or one of {sorted(_DIAG_OBJECT_GETTERS)}",
        }
    return {"class": arg, "methods": _public_names(cls)}


def _diag_signature(arg: str) -> Any:
    """SWIG docstring (which carries the C++ signature) for 'Name' or 'Class.Method'."""
    parts = (arg or "").split(".")
    if not 1 <= len(parts) <= 2 or any(not p or p.startswith("_") for p in parts):
        return {"success": False, "error": "signature needs 'arg' as 'Name' or 'Class.Method'"}
    obj = getattr(RLPy, parts[0], None)
    if obj is not None and len(parts) == 2:
        obj = getattr(obj, parts[1], None)
    if obj is None:
        return {"success": False, "error": f"RLPy.{arg} not found"}
    return {"name": arg, "doc": (getattr(obj, "__doc__", None) or "").strip()}


def _diag_enum_values(arg: str) -> Any:
    if not arg or not arg.startswith("E"):
        return {"success": False, "error": "enum_values needs 'arg' as an enum prefix, e.g. 'EExportFbxOptions3_'"}
    values: dict[str, Any] = {}
    for n in dir(RLPy):
        if n.startswith(arg):
            v = getattr(RLPy, n)
            if isinstance(v, int):
                values[n] = v
    return {"prefix": arg, "values": values}


def _with_avatar(fn):
    def run(arg: str) -> Any:
        avatar = get_first_avatar()
        if not avatar:
            return {"success": False, "error": "No avatar in scene"}
        return fn(avatar, arg)
    return run


def _diag_expression_sliders(avatar, _arg: str) -> Any:
    comp = avatar.GetFacialProfileComponent()
    if not comp:
        return {"success": False, "error": "No facial profile component"}
    return {c: list(comp.GetExpressionSliderNames(c) or []) for c in comp.GetExpressionCategoryNames()}


def _diag_morph_minmax(avatar, arg: str) -> Any:
    error = _validate_morph_id(arg or "")
    if error or not arg:
        return {"success": False, "error": error or "morph_minmax needs 'arg' (morph ID)"}
    shaping = avatar.GetAvatarShapingComponent()
    if arg not in _get_all_morph_ids():
        return {"success": False, "error": f"Unknown morph ID: {arg}"}
    raw = shaping.GetShapingMorphMinMax(arg)
    # FloatPair (SWIG std::pair) must NOT be iterated: its __getitem__ is
    # `index % 2` and never raises IndexError, so list(pair) never terminates
    # (this hung CC4 during spike 0). Read .first / .second only.
    return {"id": arg, "min": float(raw.first), "max": float(raw.second)}


DIAGNOSTIC_QUERIES: dict[str, Any] = {
    "symbol_search": _diag_symbol_search,
    "method_list": _diag_method_list,
    "signature": _diag_signature,
    "enum_values": _diag_enum_values,
    "avatar_type": _with_avatar(lambda a, _: {"type": int(a.GetAvatarType()), "generation": int(a.GetGeneration())}),
    "facial_profile_type": _with_avatar(lambda a, _: {"profile": _facial_profile_type(a)}),
    "viseme_names": _with_avatar(lambda a, _: list(a.GetVisemeComponent().GetVisemeNames() or [])),
    "expression_slider_names": _with_avatar(_diag_expression_sliders),
    "skin_bone_count": _with_avatar(lambda a, _: {"count": len(a.GetSkeletonComponent().GetSkinBones())}),
    "materials_per_mesh": _with_avatar(lambda a, _: _materials_per_mesh(a)),
    "morph_minmax": _with_avatar(_diag_morph_minmax),
    "content_files": lambda arg: browse_content(arg or "cloth_upper"),
    "plugin_path": lambda _arg: {"cc4_api": __file__},
    "morph_catalog_status": lambda _arg: morph_catalog_status(),
    "project_path": lambda _arg: {"path": RLPy.RApplication.GetCurrentProjectPath()},
}


def diagnostics(query: str, arg: str = "") -> Any:
    """Run one allowlisted read-only introspection query."""
    fn = DIAGNOSTIC_QUERIES.get(query)
    if fn is None:
        return {"success": False, "error": f"Unknown query '{query}'. Allowed: {', '.join(sorted(DIAGNOSTIC_QUERIES))}"}
    if not isinstance(arg, str) or len(arg) > 256:
        return {"success": False, "error": "arg must be a string of at most 256 chars"}
    try:
        return fn(arg)
    except Exception as e:
        return {"success": False, "error": f"{query} failed: {e}"}


# --- Action registry ---
#
# The single source of truth for what the bridge can do. server.py looks actions
# and routes up here on every request, so a hot reload of this module (POST
# /reload) picks up new or changed actions without restarting CC4.
#
#   ACTIONS[name] = (handler(params) -> result, [required param names], timeout_s)

def _opt_int(p: dict, key: str) -> int | None:
    return int(p[key]) if p.get(key) is not None else None


def _export_fbx_action(p: dict) -> Any:
    return export_fbx(
        p["output_path"],
        int(p.get("options", 0)),
        target_tool=p.get("target_tool", ""),
        sub_d_level=_opt_int(p, "sub_d_level"),
        include_current_pose=bool(p.get("include_current_pose", False)),
        delete_hidden_faces=bool(p.get("delete_hidden_faces", False)),
        use_smooth_mesh=bool(p.get("use_smooth_mesh", False)),
        remove_eyelash=bool(p.get("remove_eyelash", False)),
        remove_tearline_occlusion=bool(p.get("remove_tearline_occlusion", False)),
        embed_textures=bool(p.get("embed_textures", False)),
        export_motion=bool(p.get("export_motion", True)),
        fps=_opt_int(p, "fps"),
        motion_range=p.get("motion_range"),
        convert_image_format=bool(p.get("convert_image_format", False)),
        texture_size=_opt_int(p, "texture_size"),
        export_json=bool(p.get("export_json", False)),
        instalod_preset=bool(p.get("instalod_preset", False)),
        include_motion_path=str(p.get("include_motion_path", "")),
        motion_only=bool(p.get("motion_only", False)),
    )


DEFAULT_TIMEOUT_S = 30.0
LONG_TIMEOUT_S = 300.0

ACTIONS: dict[str, tuple[Any, list[str], float]] = {
    # Avatar / scene
    "get_avatars":           (lambda p: get_avatars(), [], DEFAULT_TIMEOUT_S),
    "get_avatar_info":       (lambda p: get_avatar_info(), [], DEFAULT_TIMEOUT_S),
    "create_default_avatar": (lambda p: create_default_avatar(), [], LONG_TIMEOUT_S),
    "delete_avatar":         (lambda p: delete_avatar(p.get("name", "")), [], DEFAULT_TIMEOUT_S),
    "undo":                  (lambda p: undo(), [], DEFAULT_TIMEOUT_S),
    "redo":                  (lambda p: redo(), [], DEFAULT_TIMEOUT_S),
    # Morphs
    "get_morph_catalog":     (lambda p: get_morph_catalog(), [], DEFAULT_TIMEOUT_S),
    "morph_catalog_status":  (lambda p: morph_catalog_status(), [], DEFAULT_TIMEOUT_S),
    "search_morphs":         (lambda p: search_morphs_v2(p["query"], p.get("category", ""), int(p.get("limit", 25))), ["query"], DEFAULT_TIMEOUT_S),
    "get_morph_value":       (lambda p: get_morph_value(p["morph_id"]), ["morph_id"], DEFAULT_TIMEOUT_S),
    "set_morphs":            (lambda p: set_morphs(p["morphs"]), ["morphs"], DEFAULT_TIMEOUT_S),
    "reset_all_morphs":      (lambda p: reset_all_morphs(p.get("avatar_name", "")), [], DEFAULT_TIMEOUT_S),
    # Items
    "list_items":            (lambda p: list_items(), [], DEFAULT_TIMEOUT_S),
    "load_item":             (lambda p: load_item(p["file_path"]), ["file_path"], LONG_TIMEOUT_S),
    "remove_item":           (lambda p: remove_scene_item(p["item_name"]), ["item_name"], DEFAULT_TIMEOUT_S),
    "browse_content":        (lambda p: browse_content(p.get("folder_type", "cloth_upper")), [], DEFAULT_TIMEOUT_S),
    "set_color":             (lambda p: set_color(p["target"], float(p["r"]), float(p["g"]), float(p["b"])), ["target", "r", "g", "b"], DEFAULT_TIMEOUT_S),
    # Project / optimize / export
    "save_project_as":       (lambda p: save_project_as(p["path"]), ["path"], LONG_TIMEOUT_S),
    "convert_lod":           (lambda p: convert_lod(p["level"], bool(p.get("bake_expression", True))), ["level"], LONG_TIMEOUT_S),
    "merge_materials":       (lambda p: merge_materials(p.get("mesh_names"), int(p.get("texture_size", 1024))), [], LONG_TIMEOUT_S),
    "check_export_license":  (lambda p: check_export_license(p.get("item", "")), [], DEFAULT_TIMEOUT_S),
    "export_fbx":            (_export_fbx_action, ["output_path"], LONG_TIMEOUT_S),
    "capture_views":         (lambda p: capture_views(p.get("presets"), int(p.get("width", 1280)), int(p.get("height", 720)),
                                                      p.get("output_dir", ""), p.get("prefix", "view")), [], LONG_TIMEOUT_S),
    # Look-dev (kept per Phase 0 review)
    "get_camera_info":       (lambda p: get_camera_info(), [], DEFAULT_TIMEOUT_S),
    "set_camera_focal_length": (lambda p: set_camera_focal_length(float(p["focal_length"])), ["focal_length"], DEFAULT_TIMEOUT_S),
    "frame_camera":          (lambda p: frame_camera(p.get("view", "face")), [], DEFAULT_TIMEOUT_S),
    "get_lights":            (lambda p: get_lights(), [], DEFAULT_TIMEOUT_S),
    "set_light_color":       (lambda p: set_light_color(p["light_name"], float(p["r"]), float(p["g"]), float(p["b"])), ["light_name", "r", "g", "b"], DEFAULT_TIMEOUT_S),
    "get_light_info":        (lambda p: get_light_info(p["light_name"]), ["light_name"], DEFAULT_TIMEOUT_S),
    "set_light_multiplier":  (lambda p: set_light_multiplier(p["light_name"], float(p["multiplier"])), ["light_name", "multiplier"], DEFAULT_TIMEOUT_S),
    "set_light_active":      (lambda p: set_light_active(p["light_name"], bool(p["active"])), ["light_name", "active"], DEFAULT_TIMEOUT_S),
    "set_light_shadow":      (lambda p: set_light_shadow(
        p["light_name"],
        (bool(p["cast_shadow"]) if p.get("cast_shadow") is not None else None),
        (float(p["darken_strength"]) if p.get("darken_strength") is not None else None),
    ), ["light_name"], DEFAULT_TIMEOUT_S),
    "get_visual_settings":   (lambda p: get_visual_settings(), [], DEFAULT_TIMEOUT_S),
    "set_ambient":           (lambda p: set_ambient(float(p["r"]), float(p["g"]), float(p["b"])), ["r", "g", "b"], DEFAULT_TIMEOUT_S),
    "set_ibl":               (lambda p: set_ibl(p.get("image_path", ""), bool(p.get("enable", True))), [], LONG_TIMEOUT_S),
    "get_expression_info":   (lambda p: get_expression_info(), [], DEFAULT_TIMEOUT_S),
    "get_material_info":     (lambda p: get_material_info(p.get("avatar_name", "")), [], DEFAULT_TIMEOUT_S),
    "get_diffuse_color":     (lambda p: get_diffuse_color(p["mesh_name"], p["material_name"]), ["mesh_name", "material_name"], DEFAULT_TIMEOUT_S),
    "set_diffuse_color":     (lambda p: set_diffuse_color(p["mesh_name"], p["material_name"], float(p["r"]), float(p["g"]), float(p["b"])), ["mesh_name", "material_name", "r", "g", "b"], DEFAULT_TIMEOUT_S),
    "get_shader_parameters": (lambda p: get_shader_parameters(p["mesh_name"], p["material_name"]), ["mesh_name", "material_name"], DEFAULT_TIMEOUT_S),
    "set_shader_parameter":  (lambda p: set_shader_parameter(p["mesh_name"], p["material_name"], p["parameter_name"], list(p["values"])), ["mesh_name", "material_name", "parameter_name", "values"], DEFAULT_TIMEOUT_S),
    # Workspace
    "set_character":         (lambda p: set_character(p.get("character", "")), [], DEFAULT_TIMEOUT_S),
    "workspace_info":        (lambda p: workspace_info(), [], DEFAULT_TIMEOUT_S),
    # Introspection
    "diagnostics":           (lambda p: diagnostics(p["query"], p.get("arg", "")), ["query"], DEFAULT_TIMEOUT_S),
}

GET_ROUTES: dict[str, str] = {
    "/avatars":         "get_avatars",
    "/avatar/info":     "get_avatar_info",
    "/morphs/catalog":  "get_morph_catalog",
    "/morphs/status":   "morph_catalog_status",
    "/items":           "list_items",
    "/camera/info":     "get_camera_info",
    "/lights":          "get_lights",
    "/visual/settings": "get_visual_settings",
    "/expressions":     "get_expression_info",
    "/material/info":   "get_material_info",
    "/workspace":       "workspace_info",
}

POST_ROUTES: dict[str, str] = {
    "/avatar/create":       "create_default_avatar",
    "/avatar/delete":       "delete_avatar",
    "/undo":                "undo",
    "/redo":                "redo",
    "/morphs/search":       "search_morphs",
    "/morph/get":           "get_morph_value",
    "/morphs/set":          "set_morphs",
    "/morphs/reset":        "reset_all_morphs",
    "/item/load":           "load_item",
    "/item/remove":         "remove_item",
    "/content/browse":      "browse_content",
    "/color":               "set_color",
    "/project/save_as":     "save_project_as",
    "/license/check":       "check_export_license",
    "/views/capture":       "capture_views",
    "/camera/focal":        "set_camera_focal_length",
    "/camera/frame":        "frame_camera",
    "/light/color":         "set_light_color",
    "/light/info":          "get_light_info",
    "/light/multiplier":    "set_light_multiplier",
    "/light/active":        "set_light_active",
    "/light/shadow":        "set_light_shadow",
    "/visual/ambient":      "set_ambient",
    "/visual/ibl":          "set_ibl",
    "/material/info":       "get_material_info",
    "/material/color/get":  "get_diffuse_color",
    "/material/color/set":  "set_diffuse_color",
    "/material/shader/get": "get_shader_parameters",
    "/material/shader/set": "set_shader_parameter",
    "/diagnostics":         "diagnostics",
    "/workspace/character": "set_character",
}

# Actions that may also be started asynchronously via POST /job/start. The job's
# status is answered from the HTTP thread (server.py job table), so a long export
# does not tie up a request for its whole duration.
JOB_ACTIONS: set[str] = {"export_fbx", "load_item", "create_default_avatar", "convert_lod", "merge_materials",
                         "save_project_as", "capture_views"}
