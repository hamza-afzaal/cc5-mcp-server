"""
CC4 probe #2: optimization & facial API discovery (READ-ONLY)
--------------------------------------------------------------
Run in Character Creator 4: Script > Load Python, with a clothed CC character loaded.

This probe changes nothing. It never calls ConvertTo (ActorBUILD/LOD conversion
is irreversible) or any export. It only introspects what the Python API exposes, so
we know which optimization steps can be automated and which stay manual.

Writes %TEMP%/cc4_probe2.json and prints a summary.
"""

import json, os, re, sys, tempfile, traceback
import RLPy

OUT = os.path.join(tempfile.gettempdir(), "cc4_probe2.json")
R = {}


def safe(name, fn):
    try:
        R[name] = fn()
    except Exception as e:
        R[name] = {"error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc(limit=2)}


def public(obj):
    return sorted(n for n in dir(obj) if not n.startswith("_"))


# 1. Top-level RLPy symbols related to optimization, LOD, merging, facial, export
PATTERN = re.compile(
    r"LOD|InstaLOD|Merge|Reduc|Remesh|Convert|Bake|Atlas|Hidden|TextureSize|"
    r"ExportFbx|ExportTexture|Viseme|Expression|Facial|ARKit|Wrinkle|Lip|"
    r"SubD|Subdiv|Bone", re.I)
safe("rlpy_symbols", lambda: [n for n in public(RLPy) if PATTERN.search(n)])

# 2. Enum families we care about, with values
def enum_family(prefix):
    return {n: int(getattr(RLPy, n)) for n in public(RLPy)
            if n.startswith(prefix) and isinstance(getattr(RLPy, n), int)}

safe("enums", lambda: {p: enum_family(p) for p in (
    "EExportFbxOptions_", "EExportFbxOptions2_", "EExportFbxOptions3_",
    "EExportTextureSize_", "EExportTextureFormat_",
    "EConvertCharacterLevel_", "EReduceBonePose_", "EAvatarType_",
    "EFacialProfile_")})

# 3. Methods on the export settings object (merge materials? texture caps? LOD?)
safe("RExportFbxSetting_methods", lambda: public(RLPy.RExportFbxSetting()))

avatars = RLPy.RScene.GetAvatars()
avatar = avatars[0] if avatars else None
R["avatar_loaded"] = bool(avatar)

if avatar:
    # 4. Avatar-level methods (ConvertTo, parts, facial profile, etc.)
    safe("RIAvatar_methods", lambda: public(avatar))
    safe("convert_to_available", lambda: hasattr(avatar, "ConvertTo"))
    safe("avatar_type_and_generation", lambda: {
        "type": int(avatar.GetAvatarType()) if hasattr(avatar, "GetAvatarType") else None,
        "generation": int(avatar.GetGeneration()) if hasattr(avatar, "GetGeneration") else None,
    })

    # 5. What the character is made of (inventory for the asset allowlist)
    def parts():
        out = {}
        for label, getter in (("clothes", "GetClothes"), ("hair", "GetHairs"), ("accessories", "GetAccessories")):
            items = getattr(avatar, getter)() if hasattr(avatar, getter) else []
            out[label] = [i.GetName() for i in items]
        out["meshes"] = list(avatar.GetMeshNames())
        return out
    safe("parts", parts)

    # 6. Blendshape inventory per mesh (visemes / expressions available to SALSA or ARKit mapping)
    def blendshapes():
        mc = avatar.GetMorphComponent()
        out = {}
        for mesh in avatar.GetMeshNames():
            try:
                names = list(mc.GetMorphNames(mesh))
            except Exception:
                names = []
            if names:
                out[mesh] = {"count": len(names), "sample": names[:15]}
        return out
    safe("blendshapes", blendshapes)

    # 7. Facial profile / expression / viseme components
    def facial():
        out = {}
        for getter in ("GetFaceComponent", "GetFacialProfileComponent", "GetVisemeComponent"):
            if hasattr(avatar, getter):
                comp = getattr(avatar, getter)()
                out[getter] = public(comp) if comp else None
        fc = avatar.GetFaceComponent() if hasattr(avatar, "GetFaceComponent") else None
        if fc and hasattr(fc, "GetExpressionGroups"):
            try:
                out["expression_groups"] = list(fc.GetExpressionGroups())
            except Exception as e:
                out["expression_groups"] = f"error: {e}"
        return out
    safe("facial", facial)

    # 8. Bone count (Quest skinning cost)
    def bones():
        sk = avatar.GetSkeletonComponent()
        return {"skin_bones": len(sk.GetSkinBones()), "motion_bones": len(sk.GetMotionBones())}
    safe("bones", bones)

    # 9. Material count across meshes (draw-call proxy before merging)
    def materials():
        mc = avatar.GetMaterialComponent()
        per_mesh = {m: len(list(mc.GetMaterialNames(m))) for m in avatar.GetMeshNames()}
        return {"total_materials": sum(per_mesh.values()), "per_mesh": per_mesh}
    safe("materials", materials)

# 10. Other modules that might expose InstaLOD / optimization
safe("candidate_modules", lambda: {
    n: public(getattr(RLPy, n)) for n in public(RLPy)
    if re.search(r"LOD|Optimi|Reduc|Remesh|Merge", n, re.I) and not n.startswith("E")})

R["python"] = sys.version
with open(OUT, "w") as f:
    json.dump(R, f, indent=2, default=str)

print("\n===== CC4 probe #2 (read-only) =====")
for k in ("avatar_loaded", "convert_to_available", "bones", "materials"):
    print(f"  {k:22s} {R.get(k)}")
print(f"  rlpy_symbols           {len(R.get('rlpy_symbols', []))} matched")
print(f"  full report: {OUT}")
