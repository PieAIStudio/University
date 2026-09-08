# 《AI 到底是什么》引用了哪些权威资料

课文是我们自己写的。这份清单是它引用的全部来历。

**这里不出现任何被参考的外部课程。** 参考提纲在纳入流程里的角色是「目录」——
它告诉我们讲什么、按什么顺序讲，而不是内容来源。逐字检查的实测结果是
最长逐字段 0–21 字（上限 40）、12 字滑窗覆盖率 0.0%–2.5%（上限 18%）。

## 按来源

### MDN Web Docs（`mdn`）

| 页面 | 用在哪 |
| --- | --- |
| [ImageData.data](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageData/data) | 一张图片在程序里是一长串像素数字 |
| [getImageData](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/getImageData) | 取出画面上某一块的像素，拿到的是按行铺开的数组 |
| [Web Audio API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API) | 声音怎么变成数字 |
| [MediaDevices.getUserMedia](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia) | 网页用摄像头必须先要权限，而且权限可以收回 |

### W3C（`w3c`）

| 页面 | 用在哪 |
| --- | --- |
| [Web Neural Network API](https://www.w3.org/TR/webnn/) | 浏览器正在标准化直接调用设备算力跑神经网络 |

### TensorFlow.js 官方文档（`official-docs`）

| 页面 | 用在哪 |
| --- | --- |
| [TensorFlow.js](https://www.tensorflow.org/js) | 模型是拿例子训练出来的，训练完能对没见过的输入给出判断 |
| [Image classification / transfer learning](https://www.tensorflow.org/js/tutorials/transfer/image_classification) | 图像分类是从带标签的例子里学的；借用别人练好的模型 |
| [Platform and environment](https://www.tensorflow.org/js/guide/platform_environment) | 浏览器里的模型可以在本机跑，数据不必离开设备 |

### Apple Developer（`official-docs`）

| 页面 | 用在哪 |
| --- | --- |
| [Local Authentication](https://developer.apple.com/documentation/localauthentication) | 系统只回答「是不是本人」，不把脸的原始数据交给应用 |

### NIST（`official-docs`）

| 页面 | 用在哪 |
| --- | --- |
| [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) | 会影响到人的场景要保留人的判断 |
| [Identifying and Managing Bias in AI](https://www.nist.gov/publications/towards-standard-identifying-and-managing-bias-artificial-intelligence) | 偏见是要主动识别和管理的风险，不是模型自己会长好 |

## 一条被丢掉的引用

`https://developer.mozilla.org/zh-CN/docs/Web/Privacy` 在起草时看起来完全合理，
实际请求返回失败。它没有被写进任何一节课。

记在这里是因为这正是 AI 写课最典型的一种错：
**一个看起来完全合理、实际不存在的链接，静态检查看不出来，人工评审也几乎发现不了。**
本课每一条 `sourceUrl` 都在写下之前真的请求过一次。

## 一处被改掉的操作步骤

动手那一节原本写「看到 **Output** 后……」。用真实浏览器走了一遍
Teachable Machine 的流程之后，能确认的是右侧面板叫 **Preview**；
`Output` 出现在训练完成之后，当时没能证实。

所以那一步改成了描述已确认的 Preview 面板。入口流程的其余细节都逐项核过，
包括 `New Image Project` 对话框里 `Standard image model` 那张卡片上写的
`224x224px color images`。
