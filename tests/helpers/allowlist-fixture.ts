import { AllowlistIndex, parseAllowlist } from "../../src/allowlist.js";

export const ALLOWLIST_FIXTURE = {
  version: 1,
  items: [
    { id: "base/cc4_camila", type: "base", path: "D:/T/Actor/CC4 Camila.ccAvatar", license: "cc4-bundled", exportable: true, scene_names: ["Camila"], verified: true },
    { id: "clothes/basic_tshirt", type: "clothes", path: "D:/T/Cloth/Basic T-shirts.ccCloth", license: "cc4-bundled", exportable: true, scene_names: ["Basic T-shirts"], verified: false },
    { id: "shoes/canvas_shoes", type: "shoes", path: "D:/T/Cloth/Canvas Shoes.ccShoes", license: "cc4-bundled", exportable: true, verified: true },
    { id: "hair/short_grey", type: "hair", path: "D:/T/Hair/Short Grey.rlHair", license: "standard", exportable: true, scene_names: ["Short Grey"], verified: true },
    { id: "clothes/icontent_coat", type: "clothes", path: "D:/T/Cloth/Fancy Coat.ccCloth", license: "icontent", exportable: false, verified: true },
    { id: "motion/female_idle_1", type: "motion", path: "D:/T/Motion/Female Idle_1.rlMotion", license: "cc4-bundled", exportable: true, verified: true },
  ],
};

export const fixtureAllowlist = () => new AllowlistIndex(parseAllowlist(ALLOWLIST_FIXTURE));
