/**
 * The island look contract is a measuring stick, not a renderer preset.
 *
 * Keep every threshold here so a failing report says how far the current
 * scene is from the same agreed bar. The values deliberately do not move with
 * the current picture; changing a threshold to make a red report green would
 * make the judge useless.
 */
export const ISLAND_LOOK_CONTRACT = {
  /**
   * 陆地占画面比例。**只对课程岛的设计机位生效**——岛群图本来就该一眼看到很多门课，
   * 推近镜头去凑这个数是用信息量换画面。donor 白天场景 84.3%。
   */
  landCoverageMin: 0.55,
  /** 陆地 L* 中位数。太暗读不出材质，太亮就洗白了。donor 64.7。 */
  landMedianLightnessMin: 50,
  landMedianLightnessMax: 70,
  /** 陆地 L* p95：受光的那一面必须真的被照亮。donor 89.5。 */
  landP95LightnessMin: 85,
  /**
   * 陆地中位 → p95 的落差。**这一对是整份合同里最难绕过去的一条**：
   * 往固有色里撒深色草点可以刷高草地跨度，但撒不出整块地被照亮这件事。
   * donor 24.8，我们 5.2。
   */
  landLightnessRiseMin: 15,
  /** 背景 L* 跨度：天空和云海不是一块平涂。donor 74.5。 */
  backgroundLightnessSpreadMin: 40,
  /** 全画面 L* 的 p2 / p98。挤在中间就是「灰蒙蒙」。donor 17.9 / 99.9。 */
  lightnessP2Max: 25,
  lightnessP98Min: 90,
  /** 全画面 L* 标准差。donor 21.1。 */
  lightnessStdDevMin: 18,
  /** 草地色相数量与跨度（度）。donor 104°。 */
  grassHueCountMin: 3,
  grassHueSpreadMin: 35,
  /** 草地自身的明暗跨度与受光面。donor 82.1 / 99.8。 */
  grassLightnessSpreadMin: 45,
  grassLightnessP95Min: 85,
  /**
   * 高饱和强调色占**陆地**面积。要有点睛，但不许满屏霓虹。
   * 两张参考图分别是 9.5% 和 1.2%，所以这是一个下限加一个宽松上限，不是窄区间。
   */
  accentAreaMin: 0.015,
  accentAreaMax: 0.15,
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
