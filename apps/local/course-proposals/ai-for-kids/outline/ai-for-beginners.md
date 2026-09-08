# 参考提纲：Microsoft AI-For-Beginners

只记章节标题与顺序，**不含正文**。它在本次纳入里的角色是「目录」——
告诉我们讲什么、按什么顺序讲。课文由我们自己写，出处指向权威原始资料。

- 来源：`https://github.com/microsoft/AI-For-Beginners`
- 授权：MIT
- 抓取日期：2026-09-08
- 规模：25 节 / 9 段 / 官方标称 12 周

## 原课章节

### I. Introduction to AI
1. Introduction and History of AI

### II. Symbolic AI
2. Knowledge Representation and Expert Systems

### III. Introduction to Neural Networks
3. Perceptron
4. Multi-Layered Perceptron and Creating our own Framework
5. Intro to Frameworks (PyTorch/TensorFlow) and Overfitting

### IV. Computer Vision
6. Intro to Computer Vision. OpenCV
7. Convolutional Neural Networks & CNN Architectures
8. Pre-trained Networks and Transfer Learning and Training Tricks
9. Autoencoders and VAEs
10. Generative Adversarial Networks & Artistic Style Transfer
11. Object Detection
12. Semantic Segmentation. U-Net

### V. Natural Language Processing
13. Text Representation. Bow/TF-IDF
14. Semantic word embeddings. Word2Vec and GloVe
15. Language Modeling. Training your own embeddings
16. Recurrent Neural Networks
17. Generative Recurrent Networks
18. Transformers. BERT.
19. Named Entity Recognition
20. Large Language Models, Prompt Programming and Few-Shot Tasks

### VI. Other AI Techniques
21. Genetic Algorithms
22. Deep Reinforcement Learning
23. Multi-Agent Systems

### VII. AI Ethics
24. AI Ethics and Responsible AI

### IX. Extras
25. Multi-Modal Networks, CLIP and VQGAN

## 读这份提纲得到的三个判断

**一、它的动手层对我们的读者完全不可用。**
原课每一节都配 Jupyter notebook，跑在 PyTorch / TensorFlow 上。我们的读者是
一个只有手机或 iPad 的十岁孩子：装不了 Python，开不了终端，也没有 notebook。
所以这不是「把代码写简单一点」的问题——**原课的动手层要整个换掉**，
换成手机浏览器里打开就能做的事。

**二、它的顺序对十岁孩子是反的。**
原课从历史与符号 AI 讲起，这是给大学生的顺序：先分类，再举例。
一个孩子需要的是相反的顺序：**先从他每天已经在用的东西讲起**
（人脸解锁、相册搜「狗」、推荐的下一个视频、游戏里的敌人），再往里走。
好奇心要排在分类法前面。

**三、有几节要藏起来，有几节要拆开。**
自编码器与 VAE、U-Net 语义分割、命名实体识别、多智能体系统，
对这个年龄不是「讲简单点」而是**这一轮不讲**——留在课程末尾的「还有什么」里点名即可。
反过来，原课一节里塞了三件事的地方（例如第 5 节把框架、过拟合、训练集测试集放在一起）
要拆成三节，因为初学者一次只接得住一件。
