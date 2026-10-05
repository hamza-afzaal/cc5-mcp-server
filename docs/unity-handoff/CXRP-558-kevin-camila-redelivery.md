# CXRP-558: Kevin + Camila re-delivery (handoff to the Unity agent)

One delivery per character: **FBX + JSON + textures together**. It bundles everything since their last import:

| Fix | Ticket | What changed |
|---|---|---|
| Underwear dropped | CXRP-542 | `Boxers` (Kevin) and `Underwear_Bottoms` (Camila) are gone from the FBX. Last time only the JSON arrived, so your FBX still has them. |
| Matte cloth | CXRP-556 | `Roughness_Value` in the JSON: T-shirt 0.85, jeans 0.8, shoes 0.8 (already merged on your side; same values) |
| Sleeve skin when seated | your 2026-10-03 reply | Upper-arm skin hidden under the T-shirt is pushed 3 cm into the body (2 cm clear of the sleeve opening), same method as Megan's sweater |
| Jeans read satin | your 2026-10-03 reply | `Biker_Jeans_Diffuse.jpg`: the painted fold highlights are toned down (owner's pick); same file name |
| Full face expressions | CXRP-553 | Same keep-list as Megan: brows 24 → 53 shapes (Kevin `Male_Brow_2`) / 24 → 47 (Camila `Camila_Brow`), eye shapes kept. The body's blendshape list and order are **unchanged** |

## 1. Copy (after the owner's yes)

Source `D:\Business\Code\art\characters\<id>\blender\`: `<id>.fbx`, `<id>.json`, `<id>.fbm\`, `textures\<id>\`
→ `Assets/_CraftXR/Art/Models/Avatars/Kevin/` and `.../Camila/`. Changed files: the FBX, the JSON and
`Biker_Jeans_Diffuse.jpg`; everything else is byte-identical.

## 2. Then in Unity

1. CCiC re-import both (FBX + JSON together, so the materials and the mesh list agree).
2. **Re-run SALSA OneClick on both prefabs.** The brow meshes gained shapes, and SALSA binds by index. The body is
   unchanged, so the visemes bind as before, but don't trust the old brow bindings.
3. Check the underwear is gone from the prefab hierarchy (no leftover renderer).
4. Quest check, seated and standing: no skin at the T-shirt sleeve or shoulder, and the jeans read matte.
   - Our check (Megan's clips, 2 bone weights): seated sleeve pokes went from every frame (up to 3 cm) to 2
     vertices for ~0.4 s at the front of Kevin's shoulder with the hand raised.
   - Stand Talk and Idle are clean.

## 3. Face pose library for both

Same poses as Megan (CXRP-553 note), with each character's mesh names:

- `D:\Business\Code\art\characters\kevin\face\kevin_face_library.json`: brow shapes on `CC_Game_Body` + `Male_Brow_2`.
- `D:\Business\Code\art\characters\camila\face\camila_face_library.json`: brow shapes on `CC_Game_Body` + `Camila_Brow`.

39 poses, 52 shapes, `missing_shapes` empty for both. The apply-by-name code from the CXRP-553 note works unchanged.

## 4. Rollback

The previous S4 outputs (542 + 556, before the sleeve, jeans and face changes) are in
`characters\<id>\blender\reports\pre_sleeve_2026-10-05\`. Your current Unity files are the rollback for everything.
