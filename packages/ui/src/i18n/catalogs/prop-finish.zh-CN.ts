export const messages = {
  "finish.diagnostic": "检查几何遮罩（红：环境光可达；绿：凸边，不是最终效果）",
  "finish.triangles": "当前物件三角面",
  "finish.costGeometry": "新增圆角几何，适合近景挑选使用",
  "finish.costMaterial": "面数不增，增加一张局部遮罩与材质计算",
  "finish.costSame": "不增加三角面",
  "finish.advice.sculpted.rock":
    "先看灰石组合的小石子：保留轮廓，让相邻切面的明暗接得更顺。这是上次实验中值得保留的部分。",
  "finish.advice.sculpted.plant":
    "树冠本身已经较圆，继续柔化的收益小。可比较，但不建议为了统一而全树套用。",
  "finish.advice.sculpted.built":
    "这种方法也会柔化平板的受光，木构和门框未必更好；需要保持硬结构时，比较“实体圆角精修”。",
  "finish.advice.bevel.rock":
    "轮廓上的尖边真正变成窄圆边，小石子不再像折纸。保留大块切面；远处很小的石头不值得增加这些面。",
  "finish.advice.bevel.plant":
    "树冠已经是圆润形体，倒角可能重复做工。这里保留对照，让你看到不值得全局打开的情况。",
  "finish.advice.bevel.built":
    "重点看喷泉的口沿、门洞边缘和推车的硬棱：亮暗过渡来自真正的窄圆面，不靠把整个面涂亮。",
  "finish.advice.crafted.rock":
    "重点看石头的大平面：细矿物起伏和克制的凸边色差，让它不再只是几块纯色。轮廓和三角面数不变。",
  "finish.advice.crafted.plant":
    "树干按木件方向处理；树冠不加三角描边，也不强行做成石头纹理。叶冠的改善更克制。",
  "finish.advice.crafted.built":
    "木件的纹理沿各自长向，涂层和接缝分别处理。不是整物件统一加噪声，也不把明暗烘焙成永久的太阳影子。",

  "finish.eyebrow": "地图物件 · 视觉精修实验",
  "finish.title": "同一个物件，四种表面",
  "finish.intro": "不是换模型来比较。取出岛上真实使用的十件物品，在相同光线下看清每种处理的作用。",
  "finish.games": "返回九个 3D 小游戏",
  "finish.methods": "选择精修方法",
  "finish.method.original": "原样",
  "finish.method.sculpted": "柔化雕塑表面",
  "finish.method.bevel": "实体圆角精修",
  "finish.method.crafted": "材质分层精修",
  "finish.about.original": "两边都是地图的原材质与原模型。灯光、底座和大小相同，这是对照起点。",
  "finish.about.sculpted":
    "让相邻面的明暗连接更柔和，减少刺眼反光。轮廓和面数不变；适合石头等圆钝物件，不是蜡质。",
  "finish.about.bevel":
    "真正削出窄窄的圆边，让棱边接住光，同时保留大面的平整。轮廓会有小幅变化，面数增加；不是整块磨成球。",
  "finish.about.crafted":
    "保留原配色，让木头顺着木件长向呈现细纹、石头有细颗粒、涂层有柔和反光。凸边与接缝由真实几何计算，不是把整件物品变暗或随机加噪声。",
  "finish.pair": "并排近看",
  "finish.gallery": "十件总览",
  "finish.reset": "重置角度",
  "finish.zoom": "放大",
  "finish.stage": "物件对照。拖动同步旋转，左右方向键也能转动。",
  "finish.failed": "对照暂时打不开。原物件未修改，可以重新加载。",
  "finish.retry": "重新打开 3D",
  "finish.loading": "正在准备十件原物件与精修副本…",
  "finish.hint": "拖动可同步旋转；左右方向键也能操作。下面选择物件，四种方法始终使用同一组灯光。",
  "finish.objects": "十件真实地图物件",
  "finish.object.rock-large": "覆草石块",
  "finish.object.rock-small": "灰石组合",
  "finish.object.fir": "针叶树",
  "finish.object.broadleaf": "阔叶树",
  "finish.object.stall": "集市摊位",
  "finish.object.cart": "木推车",
  "finish.object.lantern": "灯笼",
  "finish.object.fountain": "圆形喷泉",
  "finish.object.doorway": "方形门洞",
  "finish.object.roof": "山墙屋顶",
  "finish.boundary":
    "这些方法独立比较，不偷偷叠加。原素材、程序化地图和九个小游戏都没改；选中某种方法，不会把它应用到整个世界。",
  "finish.technical": "来源、成本与适用范围",
  "finish.technicalNote":
    "原样使用地图现有的模型读取、配色与树木生成代码。柔化只改派生法线和材质；倒角来自离线生成的模型副本；材质分层同时使用原物件的颜色角色、实际木件方向、凸边遮罩和间接光遮蔽；不叠加另两种精修。水的透明部分保留原样。",
  "finish.grade": "启用共同的最终调色",
  "finish.cost":
    "这不是三种必须全部使用的滤镜。圆角适合有硬边的道具；材质分层更适合石头、木件和涂层。树冠不描亮每条三角边；孤立凸面的遮蔽收益很小。近景与远景的成本和收益不同，整合时按物件选择。",
  "finish.retired":
    "蜡质小岛实验已退役：没有达到预期的蜡质效果。有效的物件精修方法已移到新的对照页。",
  "finish.open": "打开十件物件对照",
} as const;
