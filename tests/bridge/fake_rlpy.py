"""Minimal stand-in for CC4's RLPy module so the bridge can be tested without CC4.

Only what cc4_api/server touch at import time or in the tested paths exists here.
"""


class RStatus:
    Success = 1
    Failure = 0


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
