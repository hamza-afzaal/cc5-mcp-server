"""Minimal stand-in for CC4's RLPy module so the bridge can be tested without CC4.

Only what cc4_api/server touch at import time or in the tested paths exists here.
"""


class RStatus:
    Success = 1
    Failure = 0


class FloatPair:
    """Faithful copy of CC4's SWIG FloatPair: __getitem__ never raises IndexError,
    so iterating one never terminates. Tests use it to catch that mistake."""

    def __init__(self, first, second):
        self.first = first
        self.second = second

    def __len__(self):
        return 2

    def __getitem__(self, index):
        return self.first if not (index % 2) else self.second

    def __iter__(self):
        # Real SWIG falls back to __getitem__ forever; fail fast here instead.
        raise AssertionError("FloatPair must not be iterated (infinite in CC4)")


class _Shaping:
    MORPHS = {"Body": ["cc embed morphs/embed_full_body5"]}

    def GetShapingMorphCatergoryNames(self):
        return list(self.MORPHS)

    def GetShapingMorphIDs(self, cat):
        return list(self.MORPHS[cat])

    def GetShapingMorphDisplayNames(self, cat):
        return ["Body Thin"] if cat == "Body" else list(self.MORPHS[cat])

    def GetShapingMorphMinMax(self, morph_id):
        return FloatPair(-1.0, 1.0)

    def SetShapingMorphWeight(self, morph_id, value):
        _Shaping.weights[morph_id] = value

    def GetShapingMorphWeight(self, morph_id):
        return _Shaping.weights.get(morph_id, 0.0)

    weights = {}

    def CreateSlider(self, setting, output_path):
        """Like CC4: reports Success either way, but only makes the slider when a checksum file is set."""
        _Shaping.created.append(setting)
        if getattr(setting, "TargetMorphChecksumFilePath", ""):
            _Shaping.MORPHS.setdefault("Actor/Head", []).append(setting.MorphName)
        return RStatus.Success

    created = []


class RMorphSliderSetting:
    """Records every setter call as an attribute (SetMorphName('x') -> .MorphName == 'x')."""

    def __getattr__(self, name):
        if name.startswith("Set"):
            return lambda *args: setattr(self, name[3:], args[0] if len(args) == 1 else args)
        raise AttributeError(name)


class _Avatar:
    def __init__(self, name, avatar_id):
        self._name = name
        self._id = avatar_id

    def GetName(self):
        return self._name

    def GetID(self):
        return self._id

    def GetType(self):
        return 8

    def GetAvatarShapingComponent(self):
        return _Shaping()


class RScene:
    avatars = []
    selected = []

    @staticmethod
    def SelectObject(obj):
        RScene.selected = [obj]

    @staticmethod
    def GetAvatars():
        return list(RScene.avatars)


class RGlobal:
    @staticmethod
    def BeginAction(name):
        pass

    @staticmethod
    def EndAction():
        pass

    @staticmethod
    def ObjectModified(obj, kind):
        pass


class RFileIO:
    loaded = []

    @staticmethod
    def LoadFile(path):
        RFileIO.loaded.append(path)
        return RStatus.Success

    @staticmethod
    def LoadProject(path):
        RFileIO.loaded.append(path)
        return RStatus.Success

    @staticmethod
    def ExportObjFile(obj, path, option):
        with open(path, "w") as f:
            f.write("v 0 0 0\n")
        return RStatus.Success


class RApplication:
    @staticmethod
    def GetCurrentProjectPath():
        return r"C:\fake\project.ccProject"


class RExportFbxSetting:
    pass


EObjectModifiedType_Attribute = 1
EExport3DFileOption__None = 0
EExport3DFileOption_AxisYUp = 1
EExport3DFileOption_BodyPart = 8
EExport3DFileOption_ResetToBindPose = 64
EExport3DFileOption_GenerateDrmProtectedFile = 4
EExport3DFileOption_ExportMaterial = 512
EExport3DFileOption_EyePart = 16
EExport3DFileOption_FullBodyPart = 1024
EExport3DFileOption_AllClothes = 32
ESetCategory_Body = 0
ESetCategory_Head = 1
EChooseBase_Current = 1
EChooseBase_Default = 0
EChooseBase_File = 2
EAxisSetting_YUp = 1
EAxisSetting_ZUp = 2
EObjectModifiedType_Material = 4
EExportFbxOptions3_ExportJson = 1
EExportFbxOptions3_TraditionalUv = 4
EExportFbxOptions2_UnityPreset = 33554432
