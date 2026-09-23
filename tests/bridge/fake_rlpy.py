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
        return ["Body Thin"]

    def GetShapingMorphMinMax(self, morph_id):
        return FloatPair(-1.0, 1.0)


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


class RFileIO:
    loaded = []

    @staticmethod
    def LoadFile(path):
        RFileIO.loaded.append(path)
        return RStatus.Success


class RApplication:
    @staticmethod
    def GetCurrentProjectPath():
        return r"C:\fake\project.ccProject"


class RExportFbxSetting:
    pass


EObjectModifiedType_Attribute = 1
EObjectModifiedType_Material = 4
EExportFbxOptions3_ExportJson = 1
EExportFbxOptions3_TraditionalUv = 4
EExportFbxOptions2_UnityPreset = 33554432
