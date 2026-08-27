/**
 * The island look contract is a measuring stick, not a renderer preset.
 *
 * Keep every threshold here so a failing report says how far the current
 * scene is from the same agreed bar. The values deliberately do not move with
 * the current picture; changing a threshold to make a red report green would
 * make the judge useless.
 */
export const ISLAND_LOOK_CONTRACT = {
  /** 主体区与背景区 L* 中位数之差。低于这个数，岛和背景糊在一起。 */
  subjectBackgroundLightnessGap: 25,
  /** 全画面 L* 的 p2 / p98。挤在中间就是「灰蒙蒙」。 */
  lightnessP2Max: 25,
  lightnessP98Min: 85,
  /** 全画面 L* 标准差。 */
  lightnessStdDevMin: 18,
  /** 草地色相数量与跨度（度）。 */
  grassHueCountMin: 3,
  grassHueSpreadMin: 25,
  /** 高饱和强调色占岛面积。太少没有点睛，太多变廉价。 */
  accentAreaMin: 0.02,
  accentAreaMax: 0.05,
  /** key : fill 光比。 */
  keyToFillMin: 3,
  /** 课程岛：每个课程节点应有的装饰件数。 */
  propsPerLessonNodeMin: 7,
  /** 课程岛：半径 > 0.8 的物件占比。参考图的边缘是毛的，不是光的。 */
  rimPropShareMin: 0.2,
  /** 世界地图单岛物件数上限。世界地图走语义 LOD，不是缩小的课程岛。 */
  worldPropsPerIslandMax: 8,
  /** 课程节点被装饰物保守投影覆盖的比例上限。5% 以上就会压住路标。 */
  nodeOcclusionMax: 0.05,
  /** DOM 标签文字与其实际芯片底色的 WCAG AA 对比度下限。 */
  domLabelContrastMin: 4.5,
} as const;

export type IslandLookContract = typeof ISLAND_LOOK_CONTRACT;
