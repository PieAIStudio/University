import type { MessageCatalog } from "../types.js";

/** Product-owned English UI copy. Keep keys and interpolation slots aligned with the source catalog. */
export const messages = {
  "product.settings.interfaceLanguage": "Interface language",
  "product.worldStyle.label": "World style",
  "product.worldStyle.classic": "Classic miniature",
  "product.worldStyle.clay": "Colored clay",
  "ui.world.domain.programming": "AI & Programming",
  "ui.world.domain.programming.description":
    "Learn to build websites and apps with AI, and understand features, data, and interactions.",
  "ui.world.domain.aiFoundations": "AI Foundations",
  "ui.world.domain.aiFoundations.description":
    "Understand what AI is, along with fundamental concepts like models, training, and inference.",
  "ui.world.domain.aiGames": "AI & Games",
  "ui.world.domain.aiGames.description":
    "Learn to design and build games with AI, and understand gameplay, rules, and experience.",
  "ui.world.domain.aiMedia": "AI Media Creation",
  "ui.world.domain.aiMedia.description":
    "Learn creation methods for generative media, including images, video, and music.",
  "ui.world.domain.unpublished": "Unpublished",
  "ui.world.domain.selected": "Selected",
  "ui.world.navigation.planets": "Learning planets",
  "ui.world.navigation.archipelago": "Course archipelago",
  "ui.world.navigation.island": "Course island",
  "ui.world.domain.empty": "There are no course series in this domain yet.",
  "ui.world.domain.return": "Back to {{title}}",
  "ui.world.domain.unclassified": "Uncategorized",
  "app.mapstudio.mapStudioScreen.copy.按当前投影计量": "Measure by current projection",
  "ui.world.lessonState.current": "Current level",
  "ui.world.courseState.live": "Current",
  "ui.world.courseState.done": "Completed",
  "ui.world.courseState.open": "Available",
  "ui.world.courseState.idle": "Upcoming",
  "ui.world.overview.show": "Course island overview",
  "ui.world.overview.return": "Back to current level",
  "ui.world.overview.unavailable": "Overview is temporarily unavailable. Please try again later.",
  "ui.world.lessonState.available": "Available",
  "ui.world.lessonState.later": "Upcoming levels",
  "app.mapstudio.mapStudioScreen.copy.实际投影三角形": "Actual projected triangles",
  "app.mapstudio.mapStudioScreen.copy.原始模型尺寸":
    "Original model dimensions (width × height × depth)",
  "app.mapstudio.mapStudioScreen.copy.场景尺寸范围": "Scene size range (object local axes)",
  "app.mapstudio.mapStudioScreen.copy.实际使用与语义组": "Actual usage and semantic groups",
  "app.mapstudio.mapStudioScreen.copy.尺寸来自原始节点变换-场景统一归一化高度-树干是多变体骨架不能按整包宽度相乘":
    "Dimensions include original node transforms; the scene is normalized to a uniform height. Trunks are multi-variant skeletons and cannot be multiplied by full package width. Usage records show local island coordinates and true composite identity.",
  "app.mapstudio.mapStudioScreen.copy.组合与降级": "Composition and fallback",
  "app.mapstudio.mapStudioScreen.copy.占地-高差-坡度":
    "Group footprint / ground elevation difference / slope",
  "app.app.app.copy.书架上还没有课": "No courses on your shelf yet",
  "app.app.app.copy.今天": "Today",
  "app.app.app.copy.从这里开始": "Start here",
  "app.app.app.copy.接着上次": "Continue from last time",
  "app.app.app.copy.设置": "Settings",
  "app.app.app.copy.课程读不出来": "Could not load course",
  "app.app.app.copy.选课": "Choose courses",
  "app.app.courseIsland.copy.先看这一单元讲什么": "See what this unit covers",
  "app.app.courseIsland.copy.关": "Level",
  "app.app.courseIsland.copy.关-还剩": "Levels · Remaining",
  "app.app.courseIsland.copy.单元": "Unit ·",
  "app.app.mainRouter.copy.正在打开校园档案": "Opening campus profile…",
  "app.app.maplabels.copy.value0-门课": "{{value0}} courses",
  "app.app.maplabels.copy.已学-value0-关": "Completed {{value0}} levels",
  "app.app.pagemetadata.copy.University-在群岛上把一件事学到会":
    "University — Master one thing on the islands.",
  "app.app.pagemetadata.copy.value0-本节-value1": "{{value0}} This lesson: {{value1}}.",
  "app.app.pagemetadata.copy.value0-本节-value1-m4ij3g": "{{value0}}, this lesson: {{value1}}.",
  "app.app.profileAvatar.copy.打开头像工坊": "Open Avatar Studio",
  "app.app.todaydata.copy.找不到这节课的版本-value0":
    "Could not find a version for this lesson: {{value0}}",
  "app.app.useshelf.copy.读不到课程": "Unable to load courses",
  "app.app.worldmodel.copy.回到value0地图": "← Back to {{value0}} map",
  "app.app.worldmodel.copy.回到课程地图": "← Back to course map",
  "app.app.worldmodel.copy.改写中": "Rewriting",
  "app.authoring.answerOverview.copy.value0-道题的首答还在等待宿主判定-暂不计算通过率":
    "First responses for {{value0}} questions are still awaiting host evaluation; pass rate is not calculated yet",
  "app.authoring.answerOverview.copy.value0答题指标": "{{value0}} response metrics",
  "app.authoring.answerOverview.copy.作者答题": "Author answers",
  "app.authoring.answerOverview.copy.作者自己的答题汇总": "Author's own answer summary",
  "app.authoring.answerOverview.copy.作者自己的进度": "Author's own progress",
  "app.authoring.answerOverview.copy.先选择一个项目": "Select a project first",
  "app.authoring.answerOverview.copy.再看一眼-哪一节卡住了":
    "Take another look: which lesson got stuck",
  "app.authoring.answerOverview.copy.只读当前浏览器的-ProgressDocument-它代表作者本人-不代表其他学习者-全体学习者的答题汇总还没接":
    "Only reads the current browser's ProgressDocument. It represents the author, not other learners; the answer summary for all learners is not connected yet, so aggregate numbers are not shown here. This column will be replaced once the owner-only aggregation API is connected in the future.",
  "app.authoring.answerOverview.copy.暂无答题数据": "No answer data yet",
  "app.authoring.answerOverview.copy.本机": "This device",
  "app.authoring.answerOverview.copy.次尝试": "attempts",
  "app.authoring.answerOverview.copy.版": "version",
  "app.authoring.answerOverview.copy.第": "Version ",
  "app.authoring.answerOverview.copy.第一次通过率": "First-time pass rate",
  "app.authoring.answerOverview.copy.答题数据来源": "Answer data source",
  "app.authoring.answerOverview.copy.节答过": "lessons answered",
  "app.authoring.answerOverview.copy.节课都还没有首答记录-自己走一遍课-答几道题之后-卡住的那几节会排在这里最前面":
    "lessons have no first-attempt records yet. Go through the course yourself and answer a few questions; the lessons where you get stuck will appear at the top here.",
  "app.authoring.answerOverview.copy.课程结构读到后-答题总览会在这里出现":
    "Once the course structure is loaded, the answer overview will appear here.",
  "app.authoring.answerOverview.copy.还有-value0-节没答过":
    " · {{value0}} lessons not answered yet",
  "app.authoring.answerOverview.copy.还没有可统计的课": "No courses available for statistics yet",
  "app.authoring.answerOverview.copy.这个浏览器的进度文档里":
    "In this browser's progress document,",
  "app.authoring.answerOverview.copy.这个项目你还没答过题":
    "You haven't answered any questions in this project yet",
  "app.authoring.answerOverview.copy.选中项目后-这里会从本机进度文档逐节列出答题事实":
    "After selecting a project, answer facts will be listed here lesson by lesson from the local progress document.",
  "app.authoring.answerOverview.copy.道题有首答记录": "questions have first-attempt records",
  "app.authoring.answerOverview.copy.首答待判定": "First attempt pending grading",
  "app.authoring.courseSection.copy.value0-value1-节": "{{value0}} / {{value1}} lessons",
  "app.authoring.courseSection.copy.个单元": "units ·",
  "app.authoring.courseSection.copy.从头再看一遍": "Review from the beginning",
  "app.authoring.courseSection.copy.件事": "things",
  "app.authoring.courseSection.copy.学完能做到的": "What you can do after completing",
  "app.authoring.courseSection.copy.已学完": "Completed",
  "app.authoring.courseSection.copy.开始第-1-节": "Start lesson 1",
  "app.authoring.courseSection.copy.张卡片": "cards",
  "app.authoring.courseSection.copy.继续第-value0-节": "Continue lesson {{value0}}",
  "app.authoring.courseSection.copy.节课": "lessons",
  "app.authoring.courseSection.copy.课程完成度": "Course completion",
  "app.authoring.courseSection.copy.道练习": "exercises ·",
  "app.authoring.emptyCampus.copy.用-AI-宿主注册一个真实项目后-它会出现在这里-源码不会被学习资料污染":
    "After registering a real project with an AI host, it will appear here; source code will not be contaminated by learning materials.",
  "app.authoring.emptyCampus.copy.第一项学习还没有准备好":
    "The first learning item is not ready yet.",
  "app.authoring.feedbackOverview.copy.SwimmerBackend-的反馈表或权限还没有就绪-这里不会拿假的意见数填上":
    "The feedback table or permissions for SwimmerBackend are not ready yet. Fake feedback counts will not be filled in here.",
  "app.authoring.feedbackOverview.copy.个内容版本": "content versions",
  "app.authoring.feedbackOverview.copy.先看大家写下了什么": "See what everyone wrote first",
  "app.authoring.feedbackOverview.copy.先选择一个项目": "Select a project first",
  "app.authoring.feedbackOverview.copy.反馈数据还没接好": "Feedback data is not connected yet",
  "app.authoring.feedbackOverview.copy.只读-SwimmerBackend-的意见-还没有读到时不会先填一个数字":
    "Only reads feedback from SwimmerBackend; a number will not be filled in beforehand if it hasn't been read yet.",
  "app.authoring.feedbackOverview.copy.学习者意见": "Learner feedback",
  "app.authoring.feedbackOverview.copy.意见会按课程和内容版本确定性分组-有真实记录后-原话会出现在这里":
    "Feedback will be deterministically grouped by course and content version; once real records exist, the original comments will appear here.",
  "app.authoring.feedbackOverview.copy.意见按课程和内容版本分组-它是线索-不是自动改课的指令":
    "Feedback is grouped by course and content version. It is a clue, not an instruction to automatically modify the course.",
  "app.authoring.feedbackOverview.copy.按课程汇总": "Summary by course",
  "app.authoring.feedbackOverview.copy.未定位到具体课程": "Not mapped to a specific course",
  "app.authoring.feedbackOverview.copy.条已定位意见": "mapped feedback items",
  "app.authoring.feedbackOverview.copy.条意见": "feedback items ·",
  "app.authoring.feedbackOverview.copy.条意见-o0kvm0": "feedback items",
  "app.authoring.feedbackOverview.copy.正在读取意见": "Loading feedback",
  "app.authoring.feedbackOverview.copy.没写内容": "(No content written)",
  "app.authoring.feedbackOverview.copy.版": "version",
  "app.authoring.feedbackOverview.copy.第": " · Version ",
  "app.authoring.feedbackOverview.copy.课程": "Course",
  "app.authoring.feedbackOverview.copy.还没有收到反馈": "No feedback yet",
  "app.authoring.feedbackOverview.copy.这组没有课程版本-所以不虚构课程对照":
    "This group has no course version, so no mock course comparison is shown.",
  "app.authoring.feedbackOverview.copy.选中项目后-这里会按课程和内容版本把意见排出来":
    "After selecting a project, feedback will be listed here by course and content version.",
  "app.authoring.feedbacksource.copy.SwimmerBackend-反馈表还没有接好":
    "SwimmerBackend feedback form is not connected yet.",
  "app.authoring.feedbacksource.copy.SwimmerBackend-答题汇总接口还没有接好":
    "SwimmerBackend answer summary API is not connected yet.",
  "app.authoring.index.copy.正在打开校园档案": "Opening campus archive…",
  "app.authoring.studioSection.copy.作者工作台": "Author Studio",
  "app.authoring.studioSection.copy.学习资料默认保存在":
    "Learning materials are saved by default in",
  "app.authoring.studioSection.copy.本机上的课从这里长出来":
    "Courses on this machine grow from here",
  "app.authoring.studioSection.copy.源码不会被学习资料污染":
    ". Source code will not be polluted by learning materials.",
  "app.authoring.studyDetail.copy.value0-个提交": "{{value0}} commits",
  "app.authoring.studyDetail.copy.与课程资料一致": "Matches course materials",
  "app.authoring.studyDetail.copy.个源码版本": "source code versions",
  "app.authoring.studyDetail.copy.主攻路线": "Main track ·",
  "app.authoring.studyDetail.copy.份项目分析": "project analyses",
  "app.authoring.studyDetail.copy.其他课程": "Other courses ·",
  "app.authoring.studyDetail.copy.打开分析": "Open analysis",
  "app.authoring.studyDetail.copy.教材版本": "Textbook version",
  "app.authoring.studyDetail.copy.正式课程尚未发布": "Official course has not been published yet",
  "app.authoring.studyDetail.copy.源码-UA-地图与课堂笔记可以先存在-但它们不会冒充经过编排的正式课程":
    "Source code, UA maps, and class notes can exist first, but they will not pose as curated official courses.",
  "app.authoring.studyDetail.copy.相差": "Difference",
  "app.authoring.studyDetail.copy.算不出-上游历史被改写过":
    "Cannot calculate (upstream history was rewritten)",
  "app.authoring.studyDetail.copy.落后是正常的-这里教的永远是上一次提升的那个提交-不是你编辑器里那份":
    "Being behind is normal: what is taught here is always the last promoted commit, not the one in your editor.",
  "app.authoring.studyDetail.copy.读不到": "Cannot read",
  "app.authoring.studyDetail.copy.课程使用版本": "Version used by course",
  "app.authoring.studyDetail.copy.课程使用的项目资料": "Project materials used by course",
  "app.authoring.studyDetail.copy.课程引用了项目的哪些文件":
    "Which project files are referenced by the course?",
  "app.authoring.studyDetail.copy.课程快照": "Course snapshot",
  "app.authoring.studyDetail.copy.资料版本较旧": "Material version is older",
  "app.authoring.studyDetail.copy.这些资料只说明课程引用了哪些源码-不代表课程学习进度":
    "These materials only show which source code the course references; they do not represent course learning progress.",
  "app.authoring.studyDetail.copy.这里的数字只统计课程引用过的源码-不是-你学了多少-点开后可以按分层查看-逐层打开文件名":
    'The numbers here only count source code referenced by the course, not "how much you have learned." Click to view by hierarchy and expand file names layer by layer.',
  "app.authoring.studyDetail.copy.门": "courses",
  "app.authoring.studyDetail.copy.项目": "Project ·",
  "app.authoring.studyDetail.copy.项目最新版本": "Latest project version",
  "app.authoring.studyDetail.copy.项目分析": "Project analysis",
  "app.authoring.studyShelf.copy.value0-门课可学习": "{{value0}} courses available to learn",
  "app.authoring.studyShelf.copy.你的学习项目": "Your learning projects",
  "app.authoring.studyShelf.copy.准备中": "Preparing",
  "app.authoring.studyShelf.copy.刚刚": "Just now",
  "app.authoring.studyShelf.copy.学习项目列表": "Learning project list",
  "app.avatarlab.avatarLab.copy.value0-件-value1-顶点-value2ms-种子-value3":
    "{{value0}} items · {{value1}} vertices · {{value2}}ms · Seed {{value3}}",
  "app.avatarlab.avatarLab.copy.个物种": "species",
  "app.avatarlab.avatarLab.copy.回到地图": "Back to map",
  "app.avatarlab.avatarLab.copy.头像工坊": "Avatar Lab",
  "app.avatarlab.avatarLab.copy.头像舞台": "Avatar Stage",
  "app.avatarlab.avatarLab.copy.套色盘": "Color palette ·",
  "app.avatarlab.avatarLab.copy.应用种子": "Apply seed",
  "app.avatarlab.avatarLab.copy.换物种-换色盘-或重掷一张脸-拖动画布绕着看":
    "Change species, swap palettes, or reroll a face. Drag the canvas to look around.",
  "app.avatarlab.avatarLab.copy.数字原样用-其它文字会哈希成种子":
    "Numbers are used as-is; other text will be hashed into a seed.",
  "app.avatarlab.avatarLab.copy.注视关": "Gaze off",
  "app.avatarlab.avatarLab.copy.注视开": "Gaze on",
  "app.avatarlab.avatarLab.copy.物种": "Species",
  "app.avatarlab.avatarLab.copy.种子": "Seed",
  "app.avatarlab.avatarLab.copy.种子-value0": "Seed {{value0}}",
  "app.avatarlab.avatarLab.copy.色盘": "Color palette",
  "app.avatarlab.avatarLab.copy.配方": "Recipe",
  "app.avatarlab.avatarLab.copy.重掷部位": "Reroll part",
  "app.avatarlab.avatarLab.copy.随机一张": "Randomize one",
  "app.catalog.courseCatalog.copy.在地图上看": "View on map",
  "app.catalog.courseCatalog.copy.正在读入课程目录": "Loading course catalog.",
  "app.catalog.courseCatalog.copy.目录": "Catalog",
  "app.catalog.courseCatalog.copy.课程目录读不出来-刷新这一页再试":
    "Could not load course catalog. Refresh this page and try again.",
  "app.content.evidencesource.copy.无法读取固定源码-value0":
    "Unable to read fixed source code ({{value0}})",
  "app.learner.uaDashboardButton.copy.打开项目地图": "Open project map",
  "app.learner.uaDashboardButton.copy.正在打开项目地图": "Opening project map…",
  "app.learner.uaDashboardButton.copy.项目地图暂时打不开": "Project map is temporarily unavailable",
  "app.lesson.assembleview.copy.自检": "Self-check",
  "app.lesson.settlement.copy.value0-value1-关": "Level {{value0}} / {{value1}}",
  "app.lesson.settlement.copy.value0-分钟后回来": "Come back in {{value0}} minutes",
  "app.lesson.settlement.copy.value0-天后回来": "Come back in {{value0}} days",
  "app.lesson.settlement.copy.value0-小时后回来": "Come back in {{value0}} hours",
  "app.lesson.settlement.copy.下一关": "Next level",
  "app.lesson.settlement.copy.今天记下的是这些": "Here is what you remembered today",
  "app.lesson.settlement.copy.回关卡地图": "Back to level map",
  "app.lesson.settlement.copy.天连击": "Day streak",
  "app.lesson.settlement.copy.岛上又立起了一间房子": "Another house has gone up on the island.",
  "app.lesson.settlement.copy.岛上开出了第一块地-井挖好了":
    "The first plot of land on the island has been cleared, and the well is dug.",
  "app.lesson.settlement.copy.张卡片进了复习队列": "cards entered the review queue",
  "app.lesson.settlement.copy.张复习卡到期": "review cards due.",
  "app.lesson.settlement.copy.明天回来": "Come back tomorrow",
  "app.lesson.settlement.copy.明天有": "Tomorrow you have",
  "app.lesson.settlement.copy.现在不用背-到期时它们会自己回来-这是间隔重复该做的事":
    "No need to memorize them now. They will come back on their own when due—that's what spaced repetition is for.",
  "app.lesson.settlement.copy.现在就可以复习": "You can review now",
  "app.lesson.settlement.copy.读完了": "Finished reading.",
  "app.lesson.settlement.copy.课程进度": "Course progress",
  "app.lesson.settlement.copy.这一节记下的概念": "Concepts remembered in this lesson",
  "app.lesson.settlement.copy.这座岛建成了-村子中央立起了会堂":
    "This island is complete—a town hall now stands in the center of the village.",
  "app.mapstudio.mapStudioScreen.copy.value0模型": "{{value0}} model",
  "app.mapstudio.mapStudioScreen.copy.value0的资源-value1-value2-value3":
    "  {{value0}} resources: {{value1}} -> {{value2}}/{{value3}}",
  "app.mapstudio.mapStudioScreen.copy.一眼看清三层地图从哪里来-左边是正在运行的场景-右边是可追溯-可预览的配方":
    "See at a glance where the three-layer map comes from. On the left is the running scene; on the right is the traceable, previewable recipe.",
  "app.mapstudio.mapStudioScreen.copy.作者工作台-PROCEDURAL-MAP":
    "Author Workbench / PROCEDURAL MAP",
  "app.mapstudio.mapStudioScreen.copy.光照与颜色": "Lighting and color",
  "app.mapstudio.mapStudioScreen.copy.出处": "Sources",
  "app.mapstudio.mapStudioScreen.copy.加载中": "Loading",
  "app.mapstudio.mapStudioScreen.copy.单模型三角形": "Single-model triangles",
  "app.mapstudio.mapStudioScreen.copy.只读": "Read-only",
  "app.mapstudio.mapStudioScreen.copy.可直接交给-AI-的修改说明":
    "Modification instructions ready to hand directly to AI",
  "app.mapstudio.mapStudioScreen.copy.向下滚动查看更多配方": "Scroll down to view more recipes",
  "app.mapstudio.mapStudioScreen.copy.地图配方台": "Map recipe bench",
  "app.mapstudio.mapStudioScreen.copy.地图配方检视面板": "Map recipe inspector panel",
  "app.mapstudio.mapStudioScreen.copy.地形配方": "Terrain recipe",
  "app.mapstudio.mapStudioScreen.copy.场景实现": "Scene implementation",
  "app.mapstudio.mapStudioScreen.copy.复制修改说明": "Copy modification instructions",
  "app.mapstudio.mapStudioScreen.copy.实时预览": "Live preview",
  "app.mapstudio.mapStudioScreen.copy.导出配置-JSON": "Export configuration JSON",
  "app.mapstudio.mapStudioScreen.copy.已复制修改说明": "Modification instructions copied",
  "app.mapstudio.mapStudioScreen.copy.当前实例": "Current instance",
  "app.mapstudio.mapStudioScreen.copy.当前实际用量": "Current actual usage",
  "app.mapstudio.mapStudioScreen.copy.当前预览没有未写回的修改-所有显示数值都来自真实-renderer-模块":
    "The current preview has no changes that have not been written back.\n\nAll displayed values come from the actual renderer module.",
  "app.mapstudio.mapStudioScreen.copy.技术出处": "Technical sources",
  "app.mapstudio.mapStudioScreen.copy.技术锁": "🔒 Technical lock ·",
  "app.mapstudio.mapStudioScreen.copy.数值改动和资源替换只存在于这个页面-不会写回磁盘":
    "Value changes and asset replacements only exist on this page and will not be written back to disk.",
  "app.mapstudio.mapStudioScreen.copy.文件字节": "File bytes",
  "app.mapstudio.mapStudioScreen.copy.无-程序化生成": "None: procedurally generated",
  "app.mapstudio.mapStudioScreen.copy.来源可追溯": "Traceable source",
  "app.mapstudio.mapStudioScreen.copy.来自真实-palette": "From real palette",
  "app.mapstudio.mapStudioScreen.copy.检视面板": "Inspector panel",
  "app.mapstudio.mapStudioScreen.copy.植被-装饰配方": "Vegetation / decoration recipe",
  "app.mapstudio.mapStudioScreen.copy.沿用配方": "Reuse recipe",
  "app.mapstudio.mapStudioScreen.copy.沿用配方原资源": "Reuse original recipe assets",
  "app.mapstudio.mapStudioScreen.copy.研究项目选择器": "Study project selector",
  "app.mapstudio.mapStudioScreen.copy.程序化-未使用-GLB": "Procedural / GLB not used",
  "app.mapstudio.mapStudioScreen.copy.配方原资源": "Original recipe assets",
  "app.mapstudio.mapStudioScreen.copy.网格三角形": "Mesh triangles",
  "app.mapstudio.mapStudioScreen.copy.群岛": "Archipelago",
  "app.mapstudio.mapStudioScreen.copy.行星": "Planet",
  "app.mapstudio.mapStudioScreen.copy.要改这条技术锁-必须先修订-ADR-0008":
    "To modify this technical lock, ADR-0008 must be revised first.",
  "app.mapstudio.mapStudioScreen.copy.课程岛": "Course island",
  "app.mapstudio.mapStudioScreen.copy.资源来源": "Asset sources",
  "app.mapstudio.mapStudioScreen.copy.运行时文件": "Runtime files",
  "app.mapstudio.mapStudioScreen.copy.这一层当前没有实例":
    "There are currently no instances on this layer.",
  "app.mapstudio.mapStudioScreen.copy.这一层没有外部植被-装饰模型":
    "There are no external vegetation or decoration models on this layer.",
  "app.mapstudio.mapStudioScreen.copy.预算-按屏幕像素分配": "Budget · Allocated by screen pixels",
  "app.mapstudio.mapStudioScreen.copy.预算基线": "Budget baseline",
  "app.mapstudio.mapStudioScreen.copy.预览覆盖层": "Preview overlay",
  "app.mapstudio.mapStudioScreen.copy.预览课程": "Preview course",
  "app.mapstudio.mapStudioScreen.copy.预览项目": "Preview project",
  "app.mapstudio.mapStudioScreen.copy.颜色分带": "Color banding",
  "app.mode.copy.先跑-pnpm-content-它会从-UniversityLocal-的导出包里取课程-没有-Universi":
    "Run pnpm content first; it fetches courses from the UniversityLocal export package. If there is no UniversityLocal checkout, it exits cleanly—this product does not produce content, it only delivers content.",
  "app.mode.copy.在线端": "Online client",
  "app.mode.copy.本地端": "Local client",
  "app.mode.copy.用-AI-宿主注册一个真实项目后-它会出现在这里-源码不会被学习资料污染":
    "After registering a real project with an AI host, it will appear here; source code will not be polluted by study materials.",
  "app.ports.feedback.copy.当前浏览器不提供复制功能":
    "The current browser does not support copying.",
  "app.ports.local.content.copy.这个项目的地址不对-value0":
    "The address for this project is incorrect: {{value0}}",
  "app.ports.local.content.copy.这节课的地址不对-value0":
    "The address for this lesson is incorrect: {{value0}}",
  "app.ports.local.content.copy.这道题的地址不对-value0":
    "The address for this question is incorrect: {{value0}}",
  "app.ports.local.reader.copy.标记没有更新": "Markers were not updated",
  "app.ports.local.sourceaccess.copy.作者端现在也读不到这份项目分析-value0":
    "The authoring client cannot read this project analysis right now either: {{value0}}",
  "app.ports.local.sourceaccess.copy.它会按-Understand-Anything-的项目分层-列出这门课已经引用和还没有走到的文件":
    "It will list the files this course has referenced and has not yet reached, based on Understand Anything's project layers.",
  "app.ports.local.sourceaccess.copy.完成一次项目分析后-作者端会在这里直接显示-交付端以后会在桌面端提供已授权的分析快照-浏览器和移动端则提供同一份":
    "After completing a project analysis, the authoring client will display it directly here; the delivery client will later provide authorized analysis snapshots on desktop, while browser and mobile clients will provide the same manual viewing instructions.",
  "app.ports.local.sourceaccess.copy.查看项目分层": "View project layers",
  "app.ports.local.sourceaccess.copy.正在打开项目地图": "Opening project map…",
  "app.ports.local.sourceaccess.copy.浏览器拦截了新标签页-请允许本地学习站点打开标签页后再试":
    "The browser blocked a new tab. Please allow the local learning site to open tabs and try again.",
  "app.ports.local.sourceaccess.copy.这个项目还没有可用的-Understand-Anything-分析-所以现在没有可信的分层可以展示":
    "This project does not have a usable Understand Anything analysis yet, so no trusted layers can be displayed right now.",
  "app.ports.notifications.copy.浏览器没有完成提醒设置-请稍后重试":
    "The browser did not complete reminder setup. Please try again later.",
  "app.ports.notifications.copy.浏览器没有确认已关闭这台设备的推送订阅":
    "The browser did not confirm that push subscriptions have been disabled for this device.",
  "app.ports.notifications.copy.浏览器没有返回完整的推送订阅密钥":
    "The browser did not return a complete push subscription key.",
  "app.ports.online.content.copy.复习卡内容尚未加载": "Review card content has not loaded yet",
  "app.ports.online.content.copy.复述卡内容尚未加载": "Recall card content has not loaded yet",
  "app.ports.online.content.copy.自检": "Self-check",
  "app.ports.online.content.copy.这节课不在这门课里": "This lesson is not in this course",
  "app.ports.online.content.copy.这道题不在这门课里": "This question is not in this course",
  "app.ports.online.reader.copy.无法读取固定源码-value0":
    "Cannot read pinned source code ({{value0}})",
  "app.ports.online.sourceaccess.copy.交付端拿到的是已发布的课程包-不携带被学习项目的本地仓库-也不能替项目启动本地进程-这样才能在浏览器里安全地阅读":
    "The delivery client receives published course packages, does not carry the local repository of the project being studied, and cannot launch local processes for the project; this ensures courses can be read safely in the browser.",
  "app.ports.online.sourceaccess.copy.以后会在桌面端启动已授权的项目图谱-浏览器端会提供图谱地址或手动打开步骤-移动端会提供同一份说明":
    "In the future, authorized project graphs will launch on desktop; the web version will provide the graph address or manual steps to open it, and mobile will provide the same instructions.",
  "app.ports.online.sourceaccess.copy.以后会在桌面端提供已授权的分析快照-浏览器端和移动端会提供同一份分层说明-不会把私有仓库偷偷塞进课程包":
    "In the future, authorized analysis snapshots will be available on desktop; web and mobile will provide the same layer explanation, and private repositories will not be secretly bundled into course packs.",
  "app.ports.online.sourceaccess.copy.以后会在桌面端提供项目检出与启动-浏览器端会提供克隆-切换到固定提交和启动的手动步骤-移动端也会保留同一份说明":
    "In the future, project checkout and launch will be available on desktop; the web version will provide manual steps to clone, switch to a pinned commit, and launch, and mobile will keep the same instructions.",
  "app.ports.online.sourceaccess.copy.删除正在学习的-App-版本":
    "Delete the app version you are studying",
  "app.ports.online.sourceaccess.copy.它会删除为这节课准备的临时项目检出-避免一份用完的源码继续占用空间":
    "This will delete the temporary project checkout prepared for this lesson so finished source code doesn't keep taking up space.",
  "app.ports.online.sourceaccess.copy.它会取出这节课钉住的源码版本-并给出启动步骤-让你把课文中的代码和真实-App-对上":
    "This pulls the pinned source code version for this lesson and provides launch steps so you can connect the code in the lesson with the real app.",
  "app.ports.online.sourceaccess.copy.它会打开完整的-Understand-Anything-图谱-让你从这节课引用的文件继续看整个项目的结构":
    "This opens the full Understand Anything graph so you can explore the overall project structure starting from the files referenced in this lesson.",
  "app.ports.online.sourceaccess.copy.它会按-Understand-Anything-的项目分层-列出这门课已经引用和还没有走到的文件":
    "This lists the files this course has already referenced and hasn't reached yet, organized by Understand Anything project layers.",
  "app.ports.online.sourceaccess.copy.打开-UA-项目地图": "Open UA project map",
  "app.ports.online.sourceaccess.copy.打开正在学习的-App": "Open the app you are studying",
  "app.ports.online.sourceaccess.copy.查看项目分层": "View project layers",
  "app.screens.antiPatternEntryHost.copy.没有这一条": "This entry does not exist.",
  "app.screens.antiPatternEntryHost.copy.防-AI-味儿": "← Avoid AI clichés",
  "app.screens.antiPatternEntryHost.copy.防-AI-味儿-1ury31h": "Avoid AI clichés",
  "app.screens.conceptEntryHost.copy.概念图解": "← Concept diagrams",
  "app.screens.conceptEntryHost.copy.概念图解-o4yiqz": "Concept diagrams",
  "app.screens.conceptEntryHost.copy.没有这一条": "This entry does not exist.",
  "app.screens.lazy.copy.正在打开": "Opening…",
  "app.screens.lessonScreen.copy.回到课程岛": "Back to Course Island",
  "app.screens.lessonScreen.copy.无法读取课程": "Unable to load course",
  "app.screens.lessonScreen.copy.正在打开这节课": "Opening this lesson…",
  "app.screens.lessonScreen.copy.这节课打不开": "Can't open this lesson",
  "app.screens.lessonScreen.copy.重试这节课": "Retry this lesson",
  "app.screens.practiceHost.copy.概念图解": "Concept diagrams",
  "app.screens.termEntryHost.copy.词义索引": "← Term index",
  "app.screens.termEntryHost.copy.词义索引-tppvrm": "Term index",
  "app.screens.termEntryHost.copy.词库里没有这个词义": "This definition is not in the glossary.",
  "locale.en.name": "English",
  "locale.zhCN.name": "Chinese",
  "ui.api.client.copy.本地服务重启过-安全令牌换新了-再点一次就能提交":
    "The local service restarted and your security token was refreshed. Click again to submit.",
  "ui.api.client.copy.请求失败-value0": "Request failed ({{value0}})",
  "ui.capability.aientitlements.copy.value0-因此页面不会猜测你是否有会员-也不会把请求发给-AI":
    "{{value0}} As a result, this page will not guess whether you have a membership or send requests to AI.",
  "ui.capability.aientitlements.copy.今天的开放式辅导次数已用完":
    "Today's open-ended tutoring sessions are used up",
  "ui.capability.aientitlements.copy.免费方案不包含开放式辅导-课文-关卡和今天的免费结构化批改尝试仍然可用":
    "The free plan does not include open-ended tutoring; lessons, challenges, and today's free structured grading attempts are still available.",
  "ui.capability.aientitlements.copy.它会把这张复习卡交给-AI-用自己的话再讲一遍-直到你真的弄明白":
    "It gives this review card to AI to explain it in different words until you truly understand it.",
  "ui.capability.aientitlements.copy.开放式辅导属于会员权益":
    "Open-ended tutoring is a membership benefit",
  "ui.capability.aientitlements.copy.开放式辅导权益暂时读不到":
    "Unable to check open-ended tutoring benefits right now",
  "ui.capability.aientitlements.copy.开通会员后-这个按钮会按账号当前方案开放-没有会员也不会影响复习卡本身":
    "Once you become a member, this button unlocks based on your account plan; not having a membership won't affect the review card itself.",
  "ui.capability.aientitlements.copy.当前账号的开放式辅导每日次数是-0-所以这个请求不会发给-AI":
    "This account has 0 daily open-ended tutoring sessions, so this request will not be sent to AI.",
  "ui.capability.aientitlements.copy.权益服务恢复后-重新点击这个按钮就会按账号方案判断":
    "Once membership services are restored, clicking this button again will check your account plan.",
  "ui.capability.aientitlements.copy.查看会员方案": "View membership plans",
  "ui.capability.aientitlements.copy.每日次数恢复或方案更新后-这里会重新检查-不需要把卡片重新做一遍":
    "Once your daily limit resets or your plan updates, this will be rechecked—no need to redo the card.",
  "ui.capability.capabilityExplanation.copy.为什么这一端现在做不到":
    "Why this platform can't do this right now",
  "ui.capability.capabilityExplanation.copy.以后怎么支持": "How it will be supported in the future",
  "ui.capability.capabilityExplanation.copy.关闭说明": "Close explanation",
  "ui.capability.capabilityExplanation.copy.它是什么": "What it is",
  "ui.capability.capabilityExplanation.copy.知道了": "Got it",
  "ui.catalog.catalogSurface.copy.个世界": "worlds ·",
  "ui.catalog.catalogSurface.copy.个世界里的课-按先修关系排-没有先后的就平铺":
    "worlds of lessons, arranged by prerequisites. Those without an order are laid out side by side.",
  "ui.catalog.catalogSurface.copy.先修": "Prerequisites:",
  "ui.catalog.catalogSurface.copy.单元": "units ·",
  "ui.catalog.catalogSurface.copy.可以学": "Available",
  "ui.catalog.catalogSurface.copy.在地图上看": "View on map",
  "ui.catalog.catalogSurface.copy.已完成": "Completed",
  "ui.catalog.catalogSurface.copy.未解锁": "Locked",
  "ui.catalog.catalogSurface.copy.正在学": "In progress",
  "ui.catalog.catalogSurface.copy.目录": "Contents",
  "ui.catalog.catalogSurface.copy.第-value0-层": "Level {{value0}}",
  "ui.catalog.catalogSurface.copy.节": "lessons",
  "ui.catalog.catalogSurface.copy.课程目录": "Course catalog",
  "ui.catalog.catalogSurface.copy.这几门课没有先后-所以平铺列出":
    "These courses have no set order, so they are listed flat.",
  "ui.catalog.catalogSurface.copy.门课": "courses ·",
  "ui.catalog.catalogSurface.copy.门课-qlwl1n": "courses",
  "ui.entry.defaultrenderers.copy.不该用": "When not to use",
  "ui.entry.defaultrenderers.copy.什么时候用它": "When to use it",
  "ui.entry.defaultrenderers.copy.复制提示词": "Copy prompt",
  "ui.entry.defaultrenderers.copy.它不是": "It is not:",
  "ui.entry.defaultrenderers.copy.已复制": "Copied",
  "ui.entry.defaultrenderers.copy.改前": "Before",
  "ui.entry.defaultrenderers.copy.改后": "After",
  "ui.entry.defaultrenderers.copy.本页重点": "Key points of this page",
  "ui.entry.defaultrenderers.copy.该用": "When to use",
  "ui.entry.demoMiniature.copy.切换状态": "Switch state",
  "ui.entry.entryFloatNav.copy.上一个-value0": "Previous: {{value0}}",
  "ui.entry.entryFloatNav.copy.下一个-value0": "Next: {{value0}}",
  "ui.entry.entryFloatNav.copy.相邻条目": "Adjacent entries",
  "ui.entry.entryPage.copy.你可能会说": "You might say",
  "ui.entry.entryPage.copy.你正常说就行": "Just speak naturally",
  "ui.entry.entryPage.copy.复制为-Markdown": "Copy as Markdown",
  "ui.entry.entryPage.copy.已复制": "Copied",
  "ui.entry.entryPage.copy.术语图鉴": "Illustrated glossary",
  "ui.entry.entryPage.copy.概念图解": "Concept diagrams",
  "ui.entry.entryPage.copy.防止-AI-味儿": "Avoid sounding like AI",
  "ui.entry.entryPage.copy.面包屑": "Breadcrumbs",
  "ui.entry.pronunciationButton.copy.听-value0-的英文发音":
    "Listen to the English pronunciation of {{value0}}",
  "ui.entry.pronunciationButton.copy.听发音": "Listen to pronunciation",
  "ui.entry.regionQuiz.copy.再看一眼-还有哪些块没试过":
    "\". Take another look to see which blocks you haven't tried yet.",
  "ui.entry.regionQuiz.copy.找到了": "Found it",
  "ui.entry.regionQuiz.copy.这一块是什么": "What is this block?",
  "ui.entry.regionQuiz.copy.那一块是": 'That block is "',
  "ui.entry.styleSample.copy.示意导航": "Sample navigation",
  "ui.evidence.copyLocatorButton.copy.在被学项目工作区按":
    "In the studied project workspace, press",
  "ui.evidence.copyLocatorButton.copy.复制-value0-供编辑器-value1-跳转":
    "Copy {{value0}} to jump to it in editor {{value1}}",
  "ui.evidence.copyLocatorButton.copy.复制位置": "Copy location",
  "ui.evidence.copyLocatorButton.copy.已复制": "Copied",
  "ui.evidence.copyLocatorButton.copy.粘贴后回车即可跳转": ", then paste and press Enter to jump",
  "ui.evidence.copyLocatorButton.copy.证据范围-value0": "Evidence range {{value0}} · ",
  "ui.evidence.copyLocatorButton.copy.钉在提交": "Pinned to commit",
  "ui.evidence.evidenceCode.copy.value0-第-value1-到-value2-行":
    "{{value0}} lines {{value1}} to {{value2}}",
  "ui.evidence.evidenceInlineSource.copy.固定提交": "· Pinned commit",
  "ui.evidence.evidenceInlineSource.copy.固定提交-value0": "Pinned commit {{value0}}",
  "ui.evidence.evidenceInlineSource.copy.固定源码-value0-value1":
    "Pinned source {{value0}} {{value1}}",
  "ui.evidence.evidenceInlineSource.copy.点击查看固定源码":
    'Click "View full file" to load this pinned source code',
  "ui.evidence.evidenceInlineSource.copy.无法读取固定源码": "Unable to read pinned source code ·",
  "ui.evidence.evidenceInlineSource.copy.源码": "Source code",
  "ui.evidence.evidenceInlineSource.copy.看完整文件": "View full file",
  "ui.evidence.evidenceLocatorOnly.copy.仍保留固定提交文件和行号-复制定位可跳到本地项目-打开完整文件可查看项目地图":
    "This reference still retains the pinned commit, file, and line numbers. Copy the locator to jump to your local project; open the full file to view the project map.",
  "ui.evidence.evidenceLocatorOnly.copy.未提供行号": "No line numbers provided",
  "ui.evidence.evidenceLocatorOnly.copy.源码没有随这份课程发布":
    "Source code was not published with this course",
  "ui.evidence.evidenceRail.copy.关于证据": "About evidence",
  "ui.evidence.evidenceRail.copy.在源码查看器中打开完整固定提交":
    "Open full pinned commit in source viewer",
  "ui.evidence.evidenceRail.copy.完整文件": "Full file",
  "ui.evidence.evidenceRail.copy.收起": "Collapse",
  "ui.evidence.evidenceRail.copy.无法读取这条源码证据": "Unable to read this source evidence",
  "ui.evidence.evidenceRail.copy.查看": "View",
  "ui.evidence.evidenceRail.copy.正在从固定提交读取源码": "Reading source code from pinned commit…",
  "ui.evidence.evidenceRail.copy.证据": "Evidence",
  "ui.evidence.evidenceSourceSheet.copy.上一条证据": "← Previous evidence",
  "ui.evidence.evidenceSourceSheet.copy.下一条证据": "Next evidence →",
  "ui.evidence.evidenceSourceSheet.copy.例如-dist-outDir": "For example: dist, outDir",
  "ui.evidence.evidenceSourceSheet.copy.关闭": "Close",
  "ui.evidence.evidenceSourceSheet.copy.关闭源码证据": "Close source evidence",
  "ui.evidence.evidenceSourceSheet.copy.只显示已批准的本课证据":
    "Only show approved evidence for this lesson",
  "ui.evidence.evidenceSourceSheet.copy.命中-value0-行": "Matched {{value0}} lines",
  "ui.evidence.evidenceSourceSheet.copy.固定提交": "Pinned commit",
  "ui.evidence.evidenceSourceSheet.copy.在这份源码中查找": "Search in this source code",
  "ui.evidence.evidenceSourceSheet.copy.复制失败": "Copy failed",
  "ui.evidence.evidenceSourceSheet.copy.复制定位": "Copy location",
  "ui.evidence.evidenceSourceSheet.copy.复制源码": "Copy source code",
  "ui.evidence.evidenceSourceSheet.copy.已复制定位": "Location copied",
  "ui.evidence.evidenceSourceSheet.copy.已复制源码": "Source code copied",
  "ui.evidence.evidenceSourceSheet.copy.引用范围": "Referenced range",
  "ui.evidence.evidenceSourceSheet.copy.当前浏览器不提供复制功能":
    "The current browser does not support copying",
  "ui.evidence.evidenceSourceSheet.copy.文件超过阅读器上限-仅显示受控范围-引用行仍以真实行号标出":
    "The file exceeds the reader limit; only a bounded range is shown. Referenced lines are still marked with actual line numbers.",
  "ui.evidence.evidenceSourceSheet.copy.正在从不可变提交读取完整源码":
    "Reading full source code from immutable commit…",
  "ui.evidence.evidenceSourceSheet.copy.源码证据-value0": "Source evidence · {{value0}}",
  "ui.evidence.evidenceSourceSheet.copy.源码证据定位": "Source evidence location",
  "ui.evidence.evidenceUaPlace.copy.在完整项目地图里看": "View in full project map",
  "ui.evidence.evidenceUaPlace.copy.正在打开项目地图": "Opening project map…",
  "ui.evidence.evidenceUaPlace.copy.项目地图暂时打不开": "Unable to open project map right now",
  "ui.evidence.evidenceUaPlace.copy.项目里的位置": "Location in project ·",
  "ui.evidence.evidenceUaPlace.copy.项目里的位置-这份课程引用的源码":
    "Location in project · Source code referenced in this course",
  "ui.evidence.layerCoverage.copy.value0-value1-个文件里有-value2-个被课程引用":
    "{{value0}}: {{value2}} of {{value1}} files referenced by the course",
  "ui.evidence.layerCoverage.copy.个文件": "files",
  "ui.evidence.layerCoverage.copy.个被课程引用的文件尚未出现在项目分析里":
    "files referenced by the course have not yet appeared in the project analysis.",
  "ui.evidence.layerCoverage.copy.个项目文件": "project files",
  "ui.evidence.layerCoverage.copy.以后会在桌面端提供已授权的分析快照-浏览器端和移动端会提供同一份分层说明":
    "Authorized analysis snapshots will be provided on desktop in the future; browser and mobile will provide the same layer descriptions.",
  "ui.evidence.layerCoverage.copy.关于项目位置": "About project location",
  "ui.evidence.layerCoverage.copy.关于项目地图": "About project map",
  "ui.evidence.layerCoverage.copy.关闭项目分层": "Close project layers",
  "ui.evidence.layerCoverage.copy.几乎没有课程引用-可能是有意跳过-生成产物-测试代码通常不必逐个讲-也可能是大纲根本没想到-这一栏分不出这两者-":
    "Almost no course references. It may have been intentionally skipped (generated artifacts and test code usually don't need to be covered one by one), or simply overlooked in the course outline—this column cannot distinguish between the two, only tell you where it is.",
  "ui.evidence.layerCoverage.copy.它会按-Understand-Anything-的项目分层-列出这门课已经引用和还没有走到的文件":
    "It lists files already referenced and not yet covered by this course, organized by Understand Anything project layers.",
  "ui.evidence.layerCoverage.copy.已讲到": "Covered",
  "ui.evidence.layerCoverage.copy.当前也读不到这份项目分析-value0":
    "Unable to read this project analysis right now either: {{value0}}",
  "ui.evidence.layerCoverage.copy.当前无法读取项目分析":
    "Unable to read project analysis right now.",
  "ui.evidence.layerCoverage.copy.当前没有可用的-Understand-Anything-分析-所以现在没有可信的分层可以展示":
    "No Understand Anything analysis is currently available, so no reliable layers can be displayed right now.",
  "ui.evidence.layerCoverage.copy.当前没有可直接读取的项目分层":
    "No directly readable project layers right now.",
  "ui.evidence.layerCoverage.copy.按代码分层查看文件覆盖": "View file coverage by code layer",
  "ui.evidence.layerCoverage.copy.有": "There are",
  "ui.evidence.layerCoverage.copy.为什么这一端没有完整项目分层":
    "Why doesn't this client have full project layers",
  "ui.evidence.layerCoverage.copy.查看项目分层": "View project layers",
  "ui.evidence.layerCoverage.copy.正在读取项目分层": "Reading project layers…",
  "ui.evidence.layerCoverage.copy.完整项目分层需要仓库分析-课文已经引用的文件可以直接看":
    "Full project layers require repository analysis. Files already referenced in the lesson can be viewed directly.",
  "ui.evidence.layerCoverage.copy.这节课已经引用了这些文件":
    "This lesson already references these files",
  "ui.evidence.layerCoverage.copy.这节课的文件落在项目仓库里":
    "Files for this lesson are located in the project repository",
  "ui.evidence.layerCoverage.copy.项目文件覆盖分析": "Project file coverage analysis",
  "ui.evidence.lessonSources.copy.出处": "Sources",
  "ui.evidence.loadevidencesnippet.copy.无法读取固定源码": "Unable to read pinned source code",
  "ui.favourites.favouritesEmpty.copy.在词义上点一下星标-把你会反复翻到的留下来-收藏是你自己的一张小词表-跟课程进度不是一回事":
    "Click the star on a definition to save the ones you revisit often. Favorites are your own personal word list, separate from course progress.",
  "ui.favourites.favouritesEmpty.copy.浏览词义": "Browse definitions",
  "ui.favourites.favouritesEmpty.copy.还没有收藏术语": "No saved terms yet",
  "ui.favourites.favouritesScreen.copy.收藏": "Favorites",
  "ui.favourites.favouritestar.copy.取消收藏value0": "Remove {{value0}} from favorites",
  "ui.favourites.favouritestar.copy.收藏value0": "Add {{value0}} to favorites",
  "ui.favourites.favouritestar.copy.这个词义": "this definition",
  "ui.feedback.feedbackNote.copy.主题-value0": "- Theme: {{value0}}",
  "ui.feedback.feedbackNote.copy.内容版本-value0": "- Content version: {{value0}}",
  "ui.feedback.feedbackNote.copy.再试一次": "Try again",
  "ui.feedback.feedbackNote.copy.反馈没有送出-原话还在输入框里-你可以稍后重试或手动复制":
    "Feedback wasn't sent. Your message is still in the input box, so you can try again later or copy it manually.",
  "ui.feedback.feedbackNote.copy.反馈通道还没有接好": "The feedback channel is not connected yet.",
  "ui.feedback.feedbackNote.copy.发送意见": "Send feedback",
  "ui.feedback.feedbackNote.copy.壳-value0": "- Shell: {{value0}}",
  "ui.feedback.feedbackNote.copy.已复制": "Copied",
  "ui.feedback.feedbackNote.copy.已收到": "Received ✓",
  "ui.feedback.feedbackNote.copy.提意见": "Give feedback",
  "ui.feedback.feedbackNote.copy.收到-这条意见已经记下了":
    "Received. This feedback has been recorded.",
  "ui.feedback.feedbackNote.copy.收到-这条记在-value0-第-value1-版上了":
    'Received. This has been recorded for "{{value0}}", version {{value1}}.',
  "ui.feedback.feedbackNote.copy.收起": "Collapse",
  "ui.feedback.feedbackNote.copy.时间-value0": "- Time: {{value0}}",
  "ui.feedback.feedbackNote.copy.正在发送": "Sending…",
  "ui.feedback.feedbackNote.copy.没写内容": "(No content)",
  "ui.feedback.feedbackNote.copy.未定位到具体课程": "No specific course identified",
  "ui.feedback.feedbackNote.copy.已登录": "Logged in",
  "ui.feedback.feedbackNote.copy.未登录": "Not logged in",
  "ui.feedback.feedbackNote.copy.登录状态-value0": "- Login status: {{value0}}",
  "ui.feedback.feedbackNote.copy.视口-value0-value1": "- Viewport: {{value0}}×{{value1}}",
  "ui.feedback.feedbackNote.copy.练习尝试次数-value0": "- Exercise attempts: {{value0}}",
  "ui.feedback.feedbackNote.copy.课程定位-value0": "- Course location: {{value0}}",
  "ui.feedback.feedbackNote.copy.路由-value0": "- Route: {{value0}}",
  "ui.feedback.feedbackNote.copy.路由-课定位-版本-练习尝试次数-登录状态-视口和时间会自动带上":
    "Route, lesson location, version, exercise attempts, login status, viewport, and timestamp will be included automatically.",
  "ui.feedback.feedbackNote.copy.这一屏哪里不对": "What looks wrong on this screen?",
  "ui.feedback.feedbackNote.copy.这次没有送到系统-但已经复制到剪贴板-你可以把整条贴给课程作者":
    "This wasn't sent to the system, but it has been copied to the clipboard. You can paste the whole message to the course author.",
  "ui.glossary.copy.FSRS-间隔复习算法": "FSRS · Spaced Repetition Algorithm",
  "ui.glossary.copy.REV-课文版本号": "REV · Lesson Version Number",
  "ui.glossary.copy.一个被拿来研究的真实代码项目-比如-图灵密约-课程都是从它的真实文件里长出来的":
    'A real code project used for study, such as "Turing\'s Pact". Courses grow directly out of its real files.',
  "ui.glossary.copy.主攻": "Main Focus",
  "ui.glossary.copy.交给-AI-批改": "Submit for AI grading",
  "ui.glossary.copy.今天该复习的卡片数量-一次只出一张-评分之后下一张会自动补上":
    "The number of cards due for review today. They appear one at a time, and the next card loads automatically once you rate it.",
  "ui.glossary.copy.你在正文里选中一段话后记下的东西-没看懂-会攒成一份清单-高亮-只是留个记号":
    'Notes you make after selecting text in a lesson. "Didn\'t understand" gathers into a list, while "Highlight" is just a marker.',
  "ui.glossary.copy.你当前主要在学的那个项目-首页的-下一节课-只从它里面挑":
    'The project you are currently focusing on. "Next lesson" on the home page is chosen only from it.',
  "ui.glossary.copy.你的-已完成-和复习进度记在具体某一版上-课文重写会生成新版本-所以旧的完成记录不会假装还有效":
    'Your "Completed" status and review progress are tied to a specific version. Rewriting a lesson creates a new version, so old completion records won\'t pretend to still be valid.',
  "ui.glossary.copy.决定这张卡片下次什么时候再问你的算法-答得越轻松-下次间隔越长-答得吃力-很快就会再见到它":
    "The algorithm that decides when to quiz you on this card again. The easier it was to recall, the longer the next interval; the harder it was, the sooner you'll see it again.",
  "ui.glossary.copy.别的课在正文里链接到了这一节-点开可以直接跳过去-不必先回到目录":
    "Other lessons link to this one in their text. You can tap the link to jump straight there without going back to the table of contents.",
  "ui.glossary.copy.到期卡片": "Due cards",
  "ui.glossary.copy.名字是-Free-Spaced-Repetition-Scheduler-它的目标不是考你-而是尽量在你-快要忘":
    "Its name is Free Spaced Repetition Scheduler. Its goal isn't to test you, but to appear right when you are about to forget—reviewing at that moment helps you remember best.",
  "ui.glossary.copy.哪些课用到这节": "Lessons that use this one",
  "ui.glossary.copy.回答之后-你自己说这次-想起来有多费劲-这不是判对错":
    "After answering, you say how hard it was to recall this time. This isn't about right or wrong.",
  "ui.glossary.copy.回答之后-你自己说这次-想起来有多费劲-这不是判对错-对错你自己看参考答案就知道了":
    "After answering, you say how hard it was to recall this time. This isn't about right or wrong—you can check whether you were right by looking at the reference answer.",
  "ui.glossary.copy.复习卡片不受影响-已经学过的东西-不管来自哪个项目-都该按时复习":
    "Review cards aren't affected—what you've already learned should be reviewed on schedule, no matter which project it came from.",
  "ui.glossary.copy.外语模式": "Foreign Language Mode",
  "ui.glossary.copy.学习项目-study": "Study project · study",
  "ui.glossary.copy.它只回答一个问题-课程引用过项目里哪些源码文件-覆盖了每一层多少-它不是学习进度":
    "It answers only one question: which source files in the project the course has referenced, and how much of each layer is covered. It is not learning progress.",
  "ui.glossary.copy.必须先写下自己的答案-才能看参考答案":
    "You must write down your own answer before you can view the reference answer.",
  "ui.glossary.copy.我的标记": "My marks",
  "ui.glossary.copy.打开后-课文里的部分词会换成英文-鼠标停上去能看到中文释义-音标和朗读":
    "When turned on, some words in the lesson text are replaced with English. Hover over them to see Chinese definitions, phonetic symbols, and audio pronunciation.",
  "ui.glossary.copy.打开外语模式后-本课标出的英文词会汇总在这里-方便你扫一眼和标记状态":
    "When Foreign Language Mode is turned on, the English words highlighted in this lesson are collected here so you can quickly scan them and update their status.",
  "ui.glossary.copy.把题目-你的答案和判分标准打包复制走-粘贴给任何-AI-助手-它来点评":
    "Copy the question, your answer, and the grading criteria together, then paste them into any AI assistant to get feedback.",
  "ui.glossary.copy.数字会随着你的评分往下走-清零就是今天的复习做完了":
    "The number counts down as you rate cards. When it reaches zero, today's review is finished.",
  "ui.glossary.copy.朗读用的也是系统自带的语音-不会把单词发到任何服务器":
    "Pronunciation also uses your system's built-in voice and never sends words to any server.",
  "ui.glossary.copy.点-在完整项目地图里看-会打开测绘那张大图-学习进度仍留在这节课-没有这一行-只说明测绘还没给这个文件建档-不代":
    "Clicking 'View in Full Project Map' opens the full codebase map; your learning progress remains on this lesson. If this line is missing, it only means codebase mapping hasn't indexed this file yet—not that the file isn't important.",
  "ui.glossary.copy.点某一条会滚回正文里那段话并选中它-攒够了用-拷贝全部去问-AI-拷出来的内容带上每段话的出处和小节名-这样对方":
    "Clicking an item scrolls back to that paragraph in the text and selects it. Once you have enough, use 'Copy All to Ask AI'—the copied content includes each paragraph's sources and section name so the assistant knows what you are asking about. Marks are stored only in this project's study library on this machine.",
  "ui.glossary.copy.点某个词会滚到正文里第一次出现的位置-状态会影响之后复习队列里是否再见到它":
    "Clicking a word scrolls to where it first appears in the text. Its status determines whether it will appear in your review queue later.",
  "ui.glossary.copy.生词": "New words",
  "ui.glossary.copy.证据": "Evidence",
  "ui.glossary.copy.读技术文档迟早要面对英文-与其单独背单词-不如在看得懂的上下文里一点点认识它们":
    "Reading technical documentation means eventually dealing with English. Instead of memorizing words in isolation, get to know them gradually within context you can understand.",
  "ui.glossary.copy.课程内容由-AI-生成-证据是它的凭据-没有证据的说法-你有理由不信":
    "Course content is generated by AI, and evidence is its credential—if a claim has no evidence, you have reason to doubt it.",
  "ui.glossary.copy.资料仅在本机": "Data stays on this machine only",
  "ui.glossary.copy.这个应用不联网-课程-答案-复习记录全部只存在这台电脑上":
    "This app does not connect to the internet. Courses, answers, and review records exist only on this computer.",
  "ui.glossary.copy.这个应用自己不联网-所以批改这一步由你和你的-AI-助手完成":
    "This app does not connect to the internet itself, so the grading step is completed by you and your AI assistant.",
  "ui.glossary.copy.这是反向引用-不是推荐算法-本课指向别处的链接不列在这里-它们本来就长在正文里对应的那句话上-那个位置比任何列表":
    "These are backlinks, not a recommendation algorithm. Links from this lesson pointing elsewhere are not listed here—they live directly on the relevant sentences in the text, where the context is far clearer than any list. When no lessons point to this one, this section will not appear.",
  "ui.glossary.copy.这是故意的-看一遍觉得懂了-和-能自己说出来-是两回事-而只有后者会留在长期记忆里-写错也有效-努力回想这个动作":
    "This is intentional. Thinking you understand after reading once is very different from being able to explain it yourself, and only the latter stays in long-term memory. Getting it wrong still works—the effort of trying to recall strengthens memory on its own.",
  "ui.glossary.copy.这节课引用的文件-在整个项目里属于哪一层-一层就是一组干同类活的文件":
    "Which layer the files referenced in this lesson belong to in the overall project. A layer is a group of files that perform similar tasks.",
  "ui.glossary.copy.这节课文改过几次-第-1-版就是-REV-1":
    "How many times this lesson text has been revised. Version 1 is REV 1.",
  "ui.glossary.copy.这节课的说法出自被学项目里的哪个文件-哪几行-点开就能看到原文":
    "Which file and line numbers in the project under study this lesson's statements come from. Click to see the original text.",
  "ui.glossary.copy.选-重来-不丢人-它只是让这张卡片更早回来找你-诚实评分-算法才能算准间隔":
    "Choosing 'Again' is nothing to be ashamed of—it just brings this card back to you sooner. Rate honestly so the algorithm can calculate intervals accurately.",
  "ui.glossary.copy.通过答题复习": "Review by answering questions",
  "ui.glossary.copy.重来-困难-良好-简单": "Again / Hard / Good / Easy",
  "ui.glossary.copy.项目分析-文件覆盖": "Project Analysis · File Coverage",
  "ui.glossary.copy.项目的文件先按职责分层-再把课程引用过的文件数标出来-比如-24-241-表示这一层共有-241-个文件-其中-":
    "Project files are first grouped into layers by responsibility, and the number of files referenced by courses is marked. For example, '24 / 241' means this layer has 241 files in total, with 24 referenced by courses; it does not mean you completed 24 learning tasks. Click a layer to see specific file names.",
  "ui.glossary.copy.项目里的位置": "Location in project",
  "ui.lesson.lessonMargin.copy.删除": "Delete",
  "ui.lesson.lessonMargin.copy.已弄懂": "Understood",
  "ui.lesson.lessonMargin.copy.这段已不在本版课文里":
    "This section is no longer in this version of the lesson text",
  "ui.lesson.lessonMargin.copy.页边批注": "Margin notes",
  "ui.lesson.lessonMarkList.copy.value0-处没看懂": "{{value0}} unclear",
  "ui.lesson.lessonMarkList.copy.value0-处高亮": " · {{value0}} highlighted",
  "ui.lesson.lessonMarkList.copy.关于标记": "About marks",
  "ui.lesson.lessonMarkList.copy.已拷贝-value0-条-去问-AI": "Copied {{value0}} items · Ask AI",
  "ui.lesson.lessonMarkList.copy.我的标记": "My marks",
  "ui.lesson.lessonMarkList.copy.拷贝全部去问-AI-value0-条":
    "Copy all to ask AI ({{value0}} items)",
  "ui.lesson.lessonMarkList.copy.没有待解决的疑问": "No unresolved questions",
  "ui.lesson.lessonBreadcrumbs.copy.当前位置": "Current location",
  "ui.lesson.lessonBreadcrumbs.copy.回到课程地图-value0": "Back to course map: {{value0}}",
  "ui.lesson.lessonNav.copy.离开课文": "Exit lesson text",
  "ui.lesson.lessonNav.copy.课文进度": "Lesson text progress",
  "ui.lesson.lessonNextStep.copy.下一节": "Next lesson",
  "ui.lesson.lessonNextStep.copy.下一节-第": "Next lesson · Lesson ",
  "ui.lesson.lessonNextStep.copy.先去下一节": "Go to next lesson first",
  "ui.lesson.lessonNextStep.copy.回到课程": "Back to course",
  "ui.lesson.lessonNextStep.copy.回到课程页可以看到这门课覆盖了项目的哪些地方-以及接下来还有哪些课":
    "Return to the course page to see which parts of the project this course covers and what lessons come next.",
  "ui.lesson.lessonNextStep.copy.学到这里": "Stop here for now",
  "ui.lesson.lessonNextStep.copy.第": "Lesson ",
  "ui.lesson.lessonNextStep.copy.继续下一节": "Continue to next lesson",
  "ui.lesson.lessonNextStep.copy.节": "lesson",
  "ui.lesson.lessonNextStep.copy.节-共": " of ",
  "ui.lesson.lessonNextStep.copy.节-这门课的最后一节": "Lesson · Last lesson of this course",
  "ui.lesson.lessonNextStep.copy.题目过了-还差确认你读过这一版-这节才会计入进度":
    "Exercises passed. You still need to confirm you've read this version for this lesson to count toward your progress.",
  "ui.lesson.lessonNextStep.copy.这节还没标为完成-上面确认课文-答完练习之后-这节才会计入进度":
    "This lesson is not marked complete yet. Once you confirm the text above and finish the exercises, this lesson will count toward your progress.",
  "ui.lesson.lessonNextStep.copy.这门课到这里就走完了": "You've reached the end of this course.",
  "ui.lesson.lessonReader.copy.再次确认本次更新": "Reconfirm this update",
  "ui.lesson.lessonReader.copy.回到刚才那一课": "← Back to the previous lesson",
  "ui.lesson.lessonReader.copy.外语模式": "Foreign language mode",
  "ui.lesson.lessonReader.copy.完成本次更新": "Complete this update",
  "ui.lesson.lessonReader.copy.已经会了-直接答这一节的题":
    "Already know this? Jump straight to this lesson's exercises",
  "ui.lesson.lessonReader.copy.已确认读过这一版-还差练习":
    "Reading confirmed for this version. Exercises remaining.",
  "ui.lesson.lessonReader.copy.打开课文-滚动页面或答对练习都不会自动完成-这个确认只针对当前固定版本":
    "Answering questions correctly doesn't mean you've read the text. Tap here to mark this lesson as read.",
  "ui.lesson.lessonReader.copy.我读完了": "I've finished reading",
  "ui.lesson.lessonReader.copy.答对不会自动完课-确认你读过这一版-进度才会记上":
    "Answering correctly won't automatically complete the lesson. Confirm you've read this version to record your progress and schedule review cards.",
  "ui.lesson.lessonReader.copy.暂时无法记录阅读确认":
    "Unable to record reading confirmation right now",
  "ui.lesson.lessonReader.copy.标准讲解": "Standard",
  "ui.lesson.lessonReader.copy.标记没有更新": "Highlights were not updated",
  "ui.lesson.lessonReader.copy.正在记录": "Recording…",
  "ui.lesson.lessonReader.copy.版": "Version",
  "ui.lesson.lessonReader.copy.第": "No.",
  "ui.lesson.lessonReader.copy.讲解层级": "Explanation level",
  "ui.lesson.lessonReader.copy.词义状态没有保存": "Word status was not saved",
  "ui.lesson.lessonReader.copy.详细讲解": "Detailed",
  "ui.lesson.lessonReader.copy.读到这里-确认你完成了这次课文更新":
    "Read up to here, then confirm you've finished this version",
  "ui.lesson.lessonReader.copy.题目过了-还差确认你读过这一版":
    "Exercises passed. You still need to confirm you've read this version.",
  "ui.lesson.lessonReader.copy.这条标记没有保存": "This highlight was not saved",
  "ui.lesson.lessonReader.copy.这版课文已经记录过阅读确认-练习通过后-系统才会把本课标为完成并安排卡片":
    "Reading confirmation has been recorded for this version of the text; once you pass the exercises, the system will mark this lesson as complete and schedule review cards.",
  "ui.lesson.lessonReader.copy.通过答题巩固刚学到的内容":
    "Reinforce what you just learned by answering questions",
  "ui.lesson.lessonReader.copy.阅读笔记": "Reading notes",
  "ui.lesson.lessonReader.copy.页边批注": "Margin notes",
  "ui.lesson.lessonRelated.copy.关于反向链接": "About backlinks",
  "ui.lesson.lessonRelated.copy.哪些课用到这节": "Which lessons use this one",
  "ui.lesson.lessonSourceVersion.copy.value0年value1月value2日": "{{value0}}-{{value1}}-{{value2}}",
  "ui.lesson.lessonSourceVersion.copy.value0月value1日": "{{value0}}/{{value1}}",
  "ui.lesson.lessonSourceVersion.copy.复制命令": "Copy command",
  "ui.lesson.lessonSourceVersion.copy.复制失败-剪贴板不可用":
    "Copy failed: clipboard is unavailable",
  "ui.lesson.lessonSourceVersion.copy.已取出到": "Checked out to",
  "ui.lesson.lessonSourceVersion.copy.已复制": "Copied",
  "ui.lesson.lessonSourceVersion.copy.打不开正在学习的-App": "Can't open the app you're studying",
  "ui.lesson.lessonSourceVersion.copy.打开正在学习的-App": "Open the app you're studying",
  "ui.lesson.lessonSourceVersion.copy.为什么浏览器打不开这个-App":
    "Why can't the browser open this app",
  "ui.lesson.lessonSourceVersion.copy.浏览器端读的是课程包-不能在这里启动这个-App":
    "The browser loads the course package and cannot launch this app here.",
  "ui.lesson.lessonSourceVersion.copy.正在删除": "Deleting…",
  "ui.lesson.lessonSourceVersion.copy.正在打开": "Opening…",
  "ui.lesson.lessonSourceVersion.copy.用完了-删掉": "Done with it? Delete it",
  "ui.lesson.lessonSourceVersion.copy.的版本": " version (",
  "ui.lesson.lessonSourceVersion.copy.这节课钉在-value0-的版本":
    "This lesson is pinned to version {{value0}}",
  "ui.lesson.lessonSourceVersion.copy.这节课钉在提交-value0":
    "This lesson is pinned to commit {{value0}}",
  "ui.lesson.lessonSourceVersion.copy.完整提交号-value0": "Full commit hash {{value0}}",
  "ui.lesson.lessonSourceVersion.copy.这个版本已经在": "This version is already in",
  "ui.lesson.lessonSourceVersion.copy.这节课钉在": "This lesson is pinned to",
  "ui.lesson.lessonWordList.copy.value0-个已处理": " · {{value0}} handled",
  "ui.lesson.lessonWordList.copy.个要留意": " need attention",
  "ui.lesson.lessonWordList.copy.关于生词": "About vocabulary",
  "ui.lesson.lessonWordList.copy.可撤销": "(can be undone)",
  "ui.lesson.lessonWordList.copy.复习中": "In review",
  "ui.lesson.lessonWordList.copy.已处理的词": "Processed words ·",
  "ui.lesson.lessonWordList.copy.待判断": "To decide",
  "ui.lesson.lessonWordList.copy.暂不学": "Skip for now",
  "ui.lesson.lessonWordList.copy.朗读声音": "Read-aloud voice",
  "ui.lesson.lessonWordList.copy.本来就会": "Already known",
  "ui.lesson.lessonWordList.copy.生词": "New words",
  "ui.lesson.lessonWordList.copy.跨日检索稳定": "Cross-day retrieval is stable",
  "ui.lesson.lessonWordList.copy.重新加入复习": "Add back to review",
  "ui.lesson.selectionMenu.copy.复制": "Copy",
  "ui.lesson.selectionMenu.copy.对选中的文字": "For selected text",
  "ui.lesson.selectionMenu.copy.已复制": "Copied",
  "ui.lesson.selectionMenu.copy.记录不懂": "Mark as not understood",
  "ui.lesson.selectionMenu.copy.问-AI": "Ask AI",
  "ui.lesson.selectionMenu.copy.高亮": "Highlight",
  "ui.loading.loadingTrivia.copy.地图正在打开": "The map is opening",
  "ui.loading.loadingTrivia.copy.地图铺开时-看一条概念": "While the map opens, read a concept",
  "ui.loading.loadingTrivia.copy.地图马上铺开": "The map will open shortly",
  "ui.loading.loadingTrivia.copy.岛屿马上就到": "The islands will arrive shortly.",
  "ui.loading.loadingTrivia.copy.每座岛是一门课-读完再练":
    "Each island is a course. Read first, then practice.",
  "ui.loading.loadingTrivia.copy.点一座岛-开始学": "Click an island to start learning",
  "ui.recovery.recoveryState.copy.3D-地图还没有准备好-可以再试一次-也可以先直接开始今天的课":
    "The 3D map is not ready yet. You can try again, or start today's lesson directly.",
  "ui.recovery.recoveryState.copy.地图刚刚失去连接-再试一次可以重新打开它-课程文字和练习不受影响":
    "The map just lost connection. Try again to reopen it; course text and exercises are not affected.",
  "ui.recovery.recoveryState.copy.地图加载得有点久": "The map is taking a while to load",
  "ui.recovery.recoveryState.copy.地图暂时停了一下": "The map paused briefly",
  "ui.recovery.recoveryState.copy.课程资料没有打开": "Course materials did not open",
  "ui.recovery.recoveryState.copy.浏览器没有提供可用的-3D-画面-课程文字和练习仍然可以继续-不必等地图":
    "The browser did not provide a usable 3D view. Course text and exercises can still continue; no need to wait for the map.",
  "ui.recovery.recoveryState.copy.这台设备打不开-3D-地图": "This device cannot open the 3D map",
  "ui.recovery.recoveryState.copy.这次没有拿到课程资料-可能是网络刚刚断了一下-再试一次-或先回到课程列表":
    "Could not retrieve course materials this time; the network may have briefly disconnected. Try again, or return to the course list first.",
  "ui.recovery.recoveryState.copy.先看课程列表": "View course list first",
  "ui.recovery.recoveryState.copy.再试一次": "Try again",
  "ui.recovery.recoveryState.copy.直接开始今天的课": "Start today's lesson directly",
  "ui.recovery.recoveryState.copy.重试课程资料": "Retry course materials",
  "ui.markdown.markdownContent.copy.value0年value1月value2日": "{{value1}}/{{value2}}/{{value0}}",
  "ui.markdown.markdownContent.copy.value0月value1日": "{{value0}}/{{value1}}",
  "ui.markdown.markdownContent.copy.你的浏览器无法播放这段本地录屏":
    "Your browser cannot play this local screen recording.",
  "ui.markdown.markdownContent.copy.在侧栏打开-课文的阅读位置留在这里":
    "Open in the sidebar; your reading position in the lesson stays here.",
  "ui.markdown.markdownContent.copy.外部图片已拦截": "External image blocked",
  "ui.markdown.markdownContent.copy.外部链接": "External link",
  "ui.markdown.markdownContent.copy.引用": "Quote",
  "ui.markdown.markdownContent.copy.文字稿": "Transcript",
  "ui.markdown.markdownContent.copy.找不到这个互动课件": "Cannot find this interactive activity:",
  "ui.markdown.markdownContent.copy.未启用的课程扩展": "Disabled course extension:",
  "ui.markdown.markdownContent.copy.本地媒体": "Local media",
  "ui.markdown.markdownContent.copy.来源": "Source",
  "ui.markdown.markdownContent.copy.真实截图": "Actual screenshot",
  "ui.markdown.markdownContent.copy.示意图-AI-插图": "Diagram · AI illustration",
  "ui.markdown.markdownContent.copy.结构图": "Structure diagram",
  "ui.markdown.markdownContent.copy.补充说明": "Additional notes",
  "ui.markdown.markdownContent.copy.词库里没有这个词义":
    "This definition is not in the vocabulary library",
  "ui.markdown.markdownContent.copy.这一课还不存在": "This lesson does not exist yet.",
  "ui.markdown.markdownContent.copy.这个位置不在本课引用的证据范围内":
    "This position is outside the scope of evidence cited in this lesson",
  "ui.markdown.markdownContent.copy.这段媒体没有通过当前课文版本的本地资产清单":
    "This media did not pass the local asset manifest for the current lesson version.",
  "ui.markdown.markdownContent.copy.链接指向的课程不存在": "The linked course does not exist",
  "ui.markdown.mermaidDiagram.copy.关系图包含外部或可执行地址-UniversityLocal-只渲染纯本地关系图":
    "The diagram contains external or executable addresses; UniversityLocal only renders purely local diagrams.",
  "ui.markdown.mermaidDiagram.copy.关系图源码超过-value0-个字符的本地上限":
    "Diagram source code exceeds the local limit of {{value0}} characters.",
  "ui.markdown.mermaidDiagram.copy.关系图超过-value0-行的本地上限-请拆成几张小图":
    "This diagram exceeds the local limit of {{value0}} lines. Please split it into smaller diagrams.",
  "ui.markdown.mermaidDiagram.copy.正在绘制关系图": "Rendering diagram…",
  "ui.markdown.mermaidDiagram.copy.这张关系图暂时无法渲染-value0-原始-Mermaid-源码已保留-可以继续阅读或修复":
    "This diagram cannot be rendered right now ({{value0}}). The original Mermaid source code has been preserved so you can keep reading or fix it.",
  "ui.markdown.remarklessonlinks.copy.这一课还不存在": "This lesson does not exist yet",
  "ui.navigation.counters.copy.你": "You",
  "ui.navigation.counters.copy.当前系列": "Current course series",
  "ui.navigation.counters.copy.连击": "Streak",
  "ui.navigation.empty.accountPanel.copy.value0-现在是-value1": "{{value0}} is now {{value1}}.",
  "ui.navigation.empty.accountPanel.copy.云端账号还未配置-当前仅保留本机离线缓存-配置完成后登录即可跨设备同步":
    "Cloud accounts are not configured yet; only the local offline cache is kept. Once configured, sign in to sync across devices.",
  "ui.navigation.empty.accountPanel.copy.免密码登录": "Passwordless sign-in",
  "ui.navigation.empty.accountPanel.copy.关闭登录说明": "Close sign-in instructions",
  "ui.navigation.empty.accountPanel.copy.创建账号": "Create account",
  "ui.navigation.empty.accountPanel.copy.发送登录链接": "Send sign-in link",
  "ui.navigation.empty.accountPanel.copy.密码": "Password",
  "ui.navigation.empty.accountPanel.copy.密码至少需要-8-个字符":
    "Password must be at least 8 characters.",
  "ui.navigation.empty.accountPanel.copy.已经登录": "Signed in",
  "ui.navigation.empty.accountPanel.copy.当前环境没有配置云端账号服务-所以现在不能登录-也不会假装已经同步-你仍可以在本机继续学习-配置账号服务后-这里":
    "Cloud account services are not configured in this environment, so you cannot sign in right now and the app will not pretend to sync. You can still continue learning on this device. Once account services are configured, sign-in will be enabled here to support cross-device sync.",
  "ui.navigation.empty.accountPanel.copy.当前页面还没有可用的登录回跳地址":
    "There is no valid sign-in redirect URL for the current page.",
  "ui.navigation.empty.accountPanel.copy.暂未开放-了解原因": "Not available yet · Learn why",
  "ui.navigation.empty.accountPanel.copy.正在登录": "Signing in…",
  "ui.navigation.empty.accountPanel.copy.没登上": "Couldn't sign in",
  "ui.navigation.empty.accountPanel.copy.登录": "Sign in",
  "ui.navigation.empty.accountPanel.copy.登录后跨设备同步": "Sync across devices after signing in",
  "ui.navigation.empty.accountPanel.copy.登录后进度-批注-答案-复习和收藏会跟账号走-断网时本机继续-联网后同步":
    "After signing in, your progress, notes, answers, reviews, and bookmarks stay with your account. Continue locally when offline, and sync once connected.",
  "ui.navigation.empty.accountPanel.copy.登录暂未开放": "Sign-in is not available yet",
  "ui.navigation.empty.accountPanel.copy.登录链接已经发到邮箱-请在这个浏览器里打开邮件中的链接-链接短时间有效":
    "A sign-in link has been requested. Check your inbox and open the link in this browser; it is valid for a short time.",
  "ui.navigation.empty.accountPanel.copy.知道了": "Got it",
  "ui.navigation.empty.accountPanel.copy.请去邮箱点开确认信-然后再回来登录":
    "Please open the confirmation email, then return here to sign in.",
  "ui.navigation.empty.accountPanel.copy.请输入有效的邮箱地址":
    "Please enter a valid email address.",
  "ui.navigation.empty.accountPanel.copy.账号": "Account",
  "ui.navigation.empty.accountPanel.copy.还差一步": "One step left",
  "ui.navigation.empty.accountPanel.copy.这次操作没有完成-请稍后再试":
    "This action could not be completed. Please try again later.",
  "ui.navigation.empty.accountPanel.copy.进度-批注-答案-复习-收藏和设置已绑定账号-断网也能继续学-连上再同步":
    "Progress, notes, answers, reviews, bookmarks, and settings are linked to your account. You can keep learning offline, and sync once connected.",
  "ui.navigation.empty.accountPanel.copy.退出登录": "Sign out",
  "ui.navigation.empty.accountPanel.copy.邮箱": "Email",
  "ui.navigation.empty.leagueEmpty.copy.你的进度已经在记录-等有了可比较的同学-排行榜就会开":
    "Your progress is already being recorded. Once there are classmates to compare with, the leaderboard will open.",
  "ui.navigation.empty.leagueEmpty.copy.排行榜还没开": "The leaderboard is not open yet",
  "ui.navigation.empty.leagueEmpty.copy.继续学习": "Continue learning",
  "ui.navigation.empty.nextStepEmpty.copy.回到学习": "Back to learning",
  "ui.navigation.empty.profileScreen.copy.复习": "Review",
  "ui.navigation.empty.profileScreen.copy.学完": "Completed",
  "ui.navigation.empty.profileScreen.copy.徽章墙": "Badge wall",
  "ui.navigation.empty.profileScreen.copy.徽章长在投放端-学完的课会记在上面":
    "Badges live on the delivery client. Completed lessons will be recorded on it.",
  "ui.navigation.empty.profileScreen.copy.段": "Section",
  "ui.navigation.empty.profileScreen.copy.练习": "Practice",
  "ui.navigation.empty.profileScreen.copy.节": "Lesson",
  "ui.navigation.empty.profileScreen.copy.设置": "Settings",
  "ui.navigation.empty.profileScreen.copy.读过真实代码": "Read real code",
  "ui.navigation.empty.profileScreen.copy.还没学完一节-从这里开始":
    "Haven't completed a lesson yet — start here",
  "ui.navigation.empty.profileScreen.copy.还没读过真实代码-第一节里就有":
    "Haven't read real code yet — it's right in the first lesson",
  "ui.navigation.empty.questsEmpty.copy.任务还没开张": "Quests haven't started yet",
  "ui.navigation.empty.questsEmpty.copy.回到学习": "Back to learning",
  "ui.navigation.empty.questsEmpty.copy.日-周-月三层任务会长在这里-今天该做的那一件事-在学习页上等着":
    "Daily, weekly, and monthly quests will appear here. The one thing to do today is waiting on the Learn page.",
  "ui.navigation.empty.reviewReminderSettings.copy.iPhone-上的-Safari-只把这项-Web-Push-能力给已经添加到主屏幕的-web-app-当前还是":
    "Safari on iPhone only gives this Web Push capability to web apps added to the Home Screen; this is currently a standard Safari page. If the option to 'Open as Web App' appears in Safari, keep it turned on—selecting a standard bookmark will still not receive push notifications.",
  "ui.navigation.empty.reviewReminderSettings.copy.允许后-University-才能在明天有复习卡时显示一条提醒":
    "Once allowed, University can show a reminder when there are review cards tomorrow.",
  "ui.navigation.empty.reviewReminderSettings.copy.在-iPhone-上先添加到主屏幕":
    "Add to Home Screen on iPhone first",
  "ui.navigation.empty.reviewReminderSettings.copy.在-iPhone-上需要先把它添加到主屏幕-并从主屏幕以-web-app-打开":
    "On iPhone, you need to add it to your Home Screen first and open it as a web app from there.",
  "ui.navigation.empty.reviewReminderSettings.copy.在-Safari-点分享-添加到主屏幕-若出现-以-web-app-打开-选项请保持开启-再从主屏幕打开-Uni":
    'In Safari, tap Share → Add to Home Screen. If the "Open as Web App" option appears, keep it turned on, then open University from your Home Screen and return here to enable it.',
  "ui.navigation.empty.reviewReminderSettings.copy.复习提醒": "Review reminders",
  "ui.navigation.empty.reviewReminderSettings.copy.复习提醒通过主屏幕里的-University-web-app-发送-就像其他-App-的通知一样":
    "Review reminders are sent through the University web app on your Home Screen, just like notifications from other apps.",
  "ui.navigation.empty.reviewReminderSettings.copy.复习提醒需要浏览器通知-推送和-Service-Worker-这几项能力":
    "Review reminders require browser notifications, push notifications, and Service Worker capabilities.",
  "ui.navigation.empty.reviewReminderSettings.copy.已开启-已订阅": "Enabled · Subscribed.",
  "ui.navigation.empty.reviewReminderSettings.copy.已订阅-但服务端还没接上-暂时不会真的收到提醒-每天最多一条-有卡才提醒":
    "Subscribed, but the server is not connected yet, so you will not actually receive reminders for now. At most one per day, only when there are cards.",
  "ui.navigation.empty.reviewReminderSettings.copy.已订阅-每天最多一条-有卡才提醒":
    "Subscribed. At most one per day, only when there are cards.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有-Service-Worker-能力":
    "Your current browser does not support Service Workers.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有-Web-Push-能力":
    "Your current browser does not support Web Push.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有提供完整的通知或推送能力-所以这里不会给你一个按了没反应的开关":
    "Your current browser does not provide complete notification or push capabilities, so we will not show an unresponsive switch here.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有通知能力":
    "Your current browser does not support notifications.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前页面不是安全连接-暂时不能建立推送订阅":
    "This page is not a secure connection; push subscriptions cannot be set up right now.",
  "ui.navigation.empty.reviewReminderSettings.copy.当前页面不是安全连接-浏览器不会在普通-HTTP-页面上建立推送订阅":
    "This page is not a secure connection; browsers will not set up push subscriptions on standard HTTP pages.",
  "ui.navigation.empty.reviewReminderSettings.copy.打开当前网站的通知权限后-回到这里再打开开关-如果浏览器没有提供入口-请按它的站点设置说明操作":
    "After enabling notification permissions for this site, return here to turn the switch on. If your browser does not provide a direct option, follow its site settings instructions.",
  "ui.navigation.empty.reviewReminderSettings.copy.换到支持-Web-Push-的安全浏览器-或在支持的设备上打开-University-你的学习进度不受影响":
    "Switch to a secure browser that supports Web Push, or open University on a supported device; your learning progress will not be affected.",
  "ui.navigation.empty.reviewReminderSettings.copy.提醒没有开启": "Reminders are not enabled",
  "ui.navigation.empty.reviewReminderSettings.copy.明天有卡时提醒我":
    "Remind me tomorrow if there are cards",
  "ui.navigation.empty.reviewReminderSettings.copy.未开启-每天最多一条-有卡才提醒-随时可以在这里关掉":
    "Off. At most one per day, only when there are cards, and you can turn it off here at any time.",
  "ui.navigation.empty.reviewReminderSettings.copy.查看怎么开启": "See how to enable",
  "ui.navigation.empty.reviewReminderSettings.copy.查看说明": "View instructions",
  "ui.navigation.empty.reviewReminderSettings.copy.正在设置提醒": "Setting up reminders…",
  "ui.navigation.empty.reviewReminderSettings.copy.浏览器已开启-但这台设备还没有订阅-打开开关后才会保存它":
    "Enabled in browser, but this device is not yet subscribed; turning the switch on will save it.",
  "ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝": "Denied by browser",
  "ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝-请到浏览器设置里手动允许-University-不会再自动弹窗":
    "Denied by browser. Please allow it manually in your browser settings; University will not prompt you again automatically.",
  "ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝通知":
    "Browser denied notifications",
  "ui.navigation.empty.reviewReminderSettings.copy.浏览器的拒绝决定只能由你在浏览器设置里改回-App-不能代替你改-也不会反复弹窗":
    "A browser denial can only be reversed by you in your browser settings. The app cannot change it for you and will not prompt you repeatedly.",
  "ui.navigation.empty.reviewReminderSettings.copy.请到浏览器的网站通知设置里允许-University-这里不会反复弹窗":
    "Please allow University in your browser's site notification settings; it will not prompt you repeatedly here.",
  "ui.navigation.empty.reviewReminderSettings.copy.这台设备暂时不支持复习提醒":
    "This device does not currently support review reminders",
  "ui.navigation.empty.reviewReminderSettings.copy.这台设备需要先准备好":
    "This device needs to be set up first",
  "ui.navigation.empty.settingsScreen.copy.一起学": "Study Together",
  "ui.navigation.empty.settingsScreen.copy.个人档案": "Profile",
  "ui.navigation.empty.settingsScreen.copy.主题": "Theme",
  "ui.navigation.empty.settingsScreen.copy.会员": "Membership",
  "ui.navigation.empty.settingsScreen.copy.偏好会随学习者账号保存-在其他设备继续使用":
    "Preferences are saved with your learner account and continue on other devices.",
  "ui.navigation.empty.settingsScreen.copy.偏好设置": "Preferences",
  "ui.navigation.empty.settingsScreen.copy.关掉以后别人看不见你停在哪一关-也不会再发出你的光标-默认开-因为这是学习小组套餐的价值-被人看着学必须能拒绝":
    "Not shared by default. When enabled, your study group can see which lesson you are studying and your cursor on the map; you can turn it off at any time.",
  "ui.navigation.empty.settingsScreen.copy.在线语音只发送产品挑选的一个英文单词-学习者自己写的字-说的话和私有仓库内容不会因为打开朗读而外发-学习者口述自":
    "Online speech only sends a single English word selected by the product; learner-written text, spoken words, and private repository contents will not be sent externally by turning on read-aloud. Learners narrating their own understanding requires an explicit separate opt-in.",
  "ui.navigation.empty.settingsScreen.copy.声音": "Sound",
  "ui.navigation.empty.settingsScreen.copy.外观": "Appearance",
  "ui.navigation.empty.settingsScreen.copy.帐户": "Account",
  "ui.navigation.empty.settingsScreen.copy.当前生效": "Currently active:",
  "ui.navigation.empty.settingsScreen.copy.朗读语音质量": "Read-aloud voice quality",
  "ui.navigation.empty.settingsScreen.copy.浅色": "Light",
  "ui.navigation.empty.settingsScreen.copy.深色": "Dark",
  "ui.navigation.empty.settingsScreen.copy.自动每次按高品质-在线-本机顺序选择当前能拿到的一档-不会把-自动-存成具体档位-高品质语音暂未开放-钱包和付费":
    '"Auto" selects the best available tier in order—high quality, online, then on-device—without saving "Auto" as a specific tier. High-quality voice is not yet available; it will be enabled once wallet and paid benefits are connected.',
  "ui.navigation.empty.settingsScreen.copy.订阅": "Subscription",
  "ui.navigation.empty.settingsScreen.copy.让小组看到我在学什么": "Let group see what I'm studying",
  "ui.navigation.empty.settingsScreen.copy.设置": "Settings",
  "ui.navigation.empty.settingsScreen.copy.语言层": "Language layer",
  "ui.navigation.empty.settingsScreen.copy.选择-跟随系统-后-会按设备的深色模式设置自动切换":
    '. Selecting "Match System" will automatically switch based on your device\'s Dark Mode settings.',
  "ui.navigation.empty.settingsScreen.copy.高品质语音暂未开放-钱包和付费权益尚未接入":
    "High-quality voice is not yet available; wallet and paid benefits are not yet connected.",
  "ui.navigation.screens.badgeWall.copy.十枚-其中四枚不是靠量能拿到的-三枚要真的过了那么多天-一枚要排程同意你确实记住了-一下午就能刷完的墙-一周后就":
    "Ten badges. Four of them cannot be earned by volume alone—three require that many days to actually pass, and one requires the scheduler to agree you have truly remembered. A wall that can be cleared in one afternoon will not say anything about you a week later.",
  "ui.navigation.screens.badgeWall.copy.已获得": "Earned",
  "ui.navigation.screens.badgeWall.copy.徽章墙": "Badge Wall",
  "ui.navigation.screens.leagueScreen.copy.到value0": "To {{value0}}",
  "ui.navigation.screens.leagueScreen.copy.和真人排名要有账号-我们不打算先摆三十个编出来的名字在这儿-那样等你发现是假的-旁边那些真数字你也不会再信了":
    "You need an account to rank with real people. We don't plan to put thirty made-up names here—once you find out they're fake, you won't trust the real numbers next to them either.",
  "ui.navigation.screens.leagueScreen.copy.天的卡片-本周读了": " days. Read this week: ",
  "ui.navigation.screens.leagueScreen.copy.已在顶阶": "Already at the top tier",
  "ui.navigation.screens.leagueScreen.copy.张": "cards",
  "ui.navigation.screens.leagueScreen.copy.张记牢了": "cards remembered",
  "ui.navigation.screens.leagueScreen.copy.排行榜": "Leaderboard",
  "ui.navigation.screens.leagueScreen.copy.段位不看你今天学了多少-看你三周之后还记得多少-今天再拼命也涨不了-这一格只有等时间过去-而你还答得对-才会动":
    "Your tier isn't about how much you study today, but how much you still remember three weeks from now. No matter how hard you push today, it won't go up—this bar only moves when time has passed and you still answer correctly.",
  "ui.navigation.screens.leagueScreen.copy.节": "lessons.",
  "ui.navigation.screens.leagueScreen.copy.记牢了-指记忆间隔已经超过":
    '"Remembered" refers to cards with a memory interval of over ',
  "ui.navigation.screens.leagueScreen.copy.还没有别人可以比": "No one else to compare with yet",
  "ui.navigation.screens.levelProgress.copy.等级进度": "Level Progress",
  "ui.navigation.screens.plansScreen.copy.也就是": ", which is ",
  "ui.navigation.screens.plansScreen.copy.价格暂时无法显示": "Price temporarily unavailable",
  "ui.navigation.screens.plansScreen.copy.会员": "Membership",
  "ui.navigation.screens.plansScreen.copy.你现在就在用": "You're currently using this",
  "ui.navigation.screens.plansScreen.copy.免费": "Free",
  "ui.navigation.screens.plansScreen.copy.刷新订单状态": "Refresh order status",
  "ui.navigation.screens.plansScreen.copy.已取消": "Canceled",
  "ui.navigation.screens.plansScreen.copy.已支付-正在刷新权益": "Paid, refreshing benefits",
  "ui.navigation.screens.plansScreen.copy.年": " / year",
  "ui.navigation.screens.plansScreen.copy.当前方案": "Current plan:",
  "ui.navigation.screens.plansScreen.copy.所有已发布课程都能免费学-课文和关卡永远不收费-绑定邮箱后-每天有少量-AI-批改尝鲜额度-用完今天停止-明天恢":
    "All published courses can be studied for free; lesson texts and levels are never charged. After linking an email, you get a small daily trial quota for AI grading; once used up, it stops for today and resets tomorrow. Membership covers the account side: continue learning when switching phones or computers, with up to three devices online at the same time.",
  "ui.navigation.screens.plansScreen.copy.随时可以取消-取消之后不再扣费":
    "You can cancel your next renewal in Subscription Management; canceling renewal does not mean an immediate refund.",
  "ui.navigation.screens.plansScreen.copy.折合": "(equivalent to ",
  "ui.navigation.screens.plansScreen.copy.按年": "Annual",
  "ui.navigation.screens.plansScreen.copy.按月": "Monthly",
  "ui.navigation.screens.plansScreen.copy.支付失败": "Payment failed",
  "ui.navigation.screens.plansScreen.copy.月": " / month",
  "ui.navigation.screens.plansScreen.copy.月-1bqki4t": "/ month)",
  "ui.navigation.screens.plansScreen.copy.正在查询": "Looking up…",
  "ui.navigation.screens.plansScreen.copy.正在检查": "Checking…",
  "ui.navigation.screens.plansScreen.copy.比按月付省": "Save compared to monthly",
  "ui.navigation.screens.plansScreen.copy.等待支付": "Awaiting payment",
  "ui.navigation.screens.plansScreen.copy.继续付款": "Continue payment",
  "ui.navigation.screens.plansScreen.copy.计费周期": "Billing cycle",
  "ui.navigation.screens.plansScreen.copy.订单号": "· Order number",
  "ui.navigation.screens.plansScreen.copy.订单状态": "Order status",
  "ui.navigation.screens.plansScreen.copy.订单状态暂时读不到-请稍后再试":
    "Unable to load order status right now. Please try again later.",
  "ui.navigation.screens.plansScreen.copy.购买": "Purchase",
  "ui.navigation.screens.plansScreen.copy.了解购买状态": "Check purchase status",
  "ui.navigation.screens.plansScreen.copy.先绑定邮箱": "Link email first",
  "ui.navigation.screens.plansScreen.copy.先登录": "Log in first",
  "ui.navigation.screens.plansScreen.copy.记录购买意向": "Record purchase intent",
  "ui.navigation.screens.plansScreen.copy.购买请求暂时失败-请稍后再试":
    "Purchase request temporarily failed. Please try again later.",
  "ui.navigation.screens.questsScreen.copy.不计分": "Not scored",
  "ui.navigation.screens.questsScreen.copy.今天": "Today",
  "ui.navigation.screens.questsScreen.copy.今天到这儿就够了": "That's enough for today",
  "ui.navigation.screens.questsScreen.copy.今天的进度": "Today's progress",
  "ui.navigation.screens.questsScreen.copy.再学下去当然可以-但今天该记住的东西已经安排好了-真正决定你记不记得住的是明天来不来-不是今天学了多少":
    "You can certainly keep studying, but what you need to remember today has already been scheduled. What really determines whether you remember is whether you show up tomorrow, not how much you study today.",
  "ui.navigation.screens.questsScreen.copy.完成": "Complete",
  "ui.navigation.screens.questsScreen.copy.每天都是同样几件-换着花样出任务是让人来开-App-的手段-天天一样才养得成习惯-而间隔重复要的就是习惯":
    "It's the same few things every day. Switching up tasks is just a way to get people to open the app; doing the same thing every day is how habits form—and spaced repetition is all about habit.",
  "ui.navigation.slots.copy.个人档案": "Profile",
  "ui.navigation.slots.copy.任务": "Tasks",
  "ui.navigation.slots.copy.会员": "Membership",
  "ui.navigation.slots.copy.作者工作台": "Author Workbench",
  "ui.navigation.slots.copy.图鉴": "Compendium",
  "ui.navigation.slots.copy.复习": "Review",
  "ui.navigation.slots.copy.学习": "Learn",
  "ui.navigation.slots.copy.我": "Profile",
  "ui.navigation.slots.copy.排行榜": "Growth",
  "ui.navigation.slots.copy.收藏": "Saved",
  "ui.navigation.slots.copy.更多": "More",
  "ui.navigation.slots.copy.目录": "Contents",
  "ui.navigation.slots.copy.练习": "Practice",
  "ui.navigation.slots.copy.设置": "Settings",
  "ui.navigation.studySwitcher.copy.value0-门-学到-value1-value2":
    "{{value0}} courses · At {{value1}}/{{value2}}",
  "ui.navigation.studySwitcher.copy.value0-门-没开始": "{{value0}} courses · Not started",
  "ui.navigation.studySwitcher.copy.当前系列-value0": "Current course series {{value0}}",
  "ui.navigation.studySwitcher.copy.换系列": "Switch course series",
  "ui.navigation.studySwitcher.copy.看所有课程系列": "View all course series",
  "ui.navigation.studySwitcher.copy.选一个项目": "Select a project",
  "ui.navigation.universityShell.copy.上下文": "Context",
  "ui.notifications.reviewReminderPrompt.copy.以后再说": "Not now",
  "ui.notifications.reviewReminderPrompt.copy.好": "OK",
  "ui.notifications.reviewReminderPrompt.copy.张复习卡回来": "review cards due",
  "ui.notifications.reviewReminderPrompt.copy.提醒没有开启-请稍后重试":
    "Reminders were not turned on. Please try again later.",
  "ui.notifications.reviewReminderPrompt.copy.明天有": "Tomorrow you have",
  "ui.notifications.reviewReminderPrompt.copy.明天的复习": "Tomorrow's review",
  "ui.notifications.reviewReminderPrompt.copy.正在开启": "Turning on…",
  "ui.notifications.reviewReminderPrompt.copy.要我提醒你吗-每天最多一条-有卡才提醒-随时可以在设置里关掉":
    "Want me to remind you? At most once a day, only when cards are due, and you can turn it off in Settings anytime.",
  "ui.path.coursePickCard.copy.先修": "Prerequisites",
  "ui.path.coursePickCard.copy.关闭": "Close",
  "ui.path.coursePickCard.copy.最多可得-XP": "Earn up to XP",
  "ui.path.coursePickCard.copy.学完这门课-你能": "After completing this course, you can:",
  "ui.path.coursePickCard.copy.层": "Level",
  "ui.path.coursePickCard.copy.无": "None",
  "ui.path.coursePickCard.copy.段真实项目代码": "real project code snippets",
  "ui.path.coursePickCard.copy.练习数": "Number of exercises",
  "ui.path.coursePickCard.copy.课时数": "Number of lessons",
  "ui.path.coursePickCard.copy.这些本事来自": "These skills come from",
  "ui.path.coursePickCard.copy.早期版本提示":
    "This course is an early version and is being rewritten. The content is readable, but the wording and explanation order do not yet meet our current standards.",
  "ui.path.coursePickCard.copy.这门课有": "This course includes:",
  "ui.path.coursePickCard.copy.进入这门课": "Enter this course",
  "ui.path.courseRouteQuiz.copy.3-个小问题": "3 quick questions",
  "app.app.courseIsland.copy.这门课假定你会什么": "What this course assumes you know",
  "app.app.courseIsland.copy.这门课假定你已经做过": "This course assumes you have already done:",
  "app.app.courseIsland.copy.要不要先去那门课测一测":
    ". Want to test yourself in that course first?",
  "app.app.courseIsland.copy.去": "Go to:",
  "app.app.courseIsland.copy.没做过也拦不住你-这里只是先说一声":
    "We won't stop you if you haven't. Just a heads-up—whether you stay or go is up to you.",
  "ui.path.coursePickCard.copy.这门课假定你已经学过上面这几门-没学过也进得去":
    "This course assumes you have already taken the courses above. You can still enter if you haven't, but it will take more effort.",
  "ui.path.courseRouteQuiz.copy.已回答": "Answered",
  "ui.path.courseRouteQuiz.copy.根据你的回答": "Based on your answers:",
  "ui.path.courseRouteQuiz.copy.看起来你可以跳过前面": "It looks like you can skip the first",
  "ui.path.courseRouteQuiz.copy.个单元-要不要各测三道": "units. Want to try 3 questions on each?",
  "ui.path.courseRouteQuiz.copy.这门课从第一节开始最省力":
    "Starting this course from the first lesson takes the least effort.",
  "ui.path.courseRouteQuiz.copy.从第一节开始": "Start from the first lesson",
  "ui.path.courseRouteQuiz.copy.回答本身不会解锁任何一节-做对题才会":
    "Answering these questions won't skip any lessons by itself. Only getting them right will.",
  "ui.path.unitSkipTest.copy.我会了": "I already know this",
  "ui.path.unitSkipTest.copy.再测一次": "Test again",
  "ui.path.unitSkipTest.copy.再试一次": "Try again",
  "ui.path.unitSkipTest.copy.交这一题": "Submit this question",
  "ui.path.unitSkipTest.copy.去读": "Read:",
  "ui.path.unitSkipTest.copy.把你的答案写在这里": "Write your answer here",
  "ui.path.unitSkipTest.copy.先写下你的答案-再交": "Write your answer first, then submit.",
  "ui.path.unitSkipTest.copy.正在从这一单元里抽题": "Selecting questions from this unit...",
  "ui.path.unitSkipTest.copy.这一单元的题没读出来-再试一次":
    "Couldn't load questions for this unit. Try again.",
  "ui.path.unitSkipTest.copy.这一单元你已经会了-做三道它自己的题就能跳过去":
    "Already know this? Answer 3 questions from this unit correctly to skip it.",
  "ui.path.unitSkipTest.copy.这一单元你已经证明过了-想再试一次也可以":
    "You've already skipped this unit. You can take it again if you'd like.",
  "ui.path.unitSkipTest.copy.这一单元凑不出三道能当场判对错的题-所以没法用做题跳过":
    "This unit doesn't have 3 questions that can be graded instantly—most of its exercises require writing full sentences. So you can't skip this unit by taking a test.",
  "ui.path.unitSkipTest.copy.三道全对-这一单元你不用从头学了":
    "All 3 correct. You don't need to start this unit from scratch.",
  "ui.path.unitSkipTest.copy.错了一道-那一节读一下-其余的算你会了":
    "You missed 1. Read that lesson, and the rest will count as completed.",
  "ui.path.unitSkipTest.copy.错了几道-这一单元还是从头读一遍吧":
    "You missed {{wrong}}. It's best to go through this unit from the beginning.",
  "ui.path.unitSkipTest.copy.跳过不等于学过-这几节的复习卡不会进复习队列-想正式读随时点进来-那时才开始排期":
    "Skipping isn't the same as studying: review cards for these lessons won't enter your review queue. If you want to study them properly, tap in anytime—they'll be scheduled then.",
  "ui.path.courseRouteQuiz.copy.你以前把一个项目改过-并重新跑起来吗":
    "Have you ever modified a project and got it running again?",
  "ui.path.courseRouteQuiz.copy.你会先建立-屏幕上的东西和文件里的代码有关-这条最重要的连接":
    "You'll start by building the most important connection: what's on screen connects to code in files.",
  "ui.path.courseRouteQuiz.copy.你已经改过并运行过项目-直接整理文件职责和运行链路更合适":
    "Since you've already modified and run projects, organizing file responsibilities and execution flow is a better fit.",
  "ui.path.courseRouteQuiz.copy.你已经见过项目文件-先把代码怎样组成界面这条线接起来更省力":
    "You've already seen project files, so connecting how code builds an interface is the smoothest next step.",
  "ui.path.courseRouteQuiz.copy.先测测你的学习起点": "First, let's find your starting point",
  "ui.path.courseRouteQuiz.copy.凭直觉回答就好": "Just go with your intuition",
  "ui.path.courseRouteQuiz.copy.如果-App-里的按钮文字不对-你第一反应更接近哪一种":
    "If button text in an app is wrong, which is closest to your first reaction?",
  "ui.path.courseRouteQuiz.copy.学习路线": "Learning path",
  "ui.path.courseRouteQuiz.copy.我会在界面里继续找": "I'd keep looking around the interface",
  "ui.path.courseRouteQuiz.copy.我会打开项目找代码并运行检查":
    "I'd open the project, find the code, and run it to check",
  "ui.path.courseRouteQuiz.copy.我会猜某个文件可能负责它":
    "I'd guess which file might be responsible for it",
  "ui.path.courseRouteQuiz.copy.我能大致说出它们分别做什么":
    "I can roughly describe what each of them does",
  "ui.path.courseRouteQuiz.copy.改过-也能自己排查问题":
    "I've modified code and can troubleshoot issues on my own",
  "ui.path.courseRouteQuiz.copy.改过小地方-但过程不太稳定":
    "I've made small tweaks, but the process wasn't very smooth",
  "ui.path.courseRouteQuiz.copy.看到-tsx-package-json-这些名字时-你大概处在什么状态":
    "When you see names like `.tsx` and `package.json`, which best describes you?",
  "ui.path.courseRouteQuiz.copy.看起来都很陌生": "They all look unfamiliar",
  "ui.path.courseRouteQuiz.copy.第": "Question",
  "ui.path.courseRouteQuiz.copy.继续回答-系统会自动判断":
    "Keep answering, and the system will assess automatically",
  "ui.path.courseRouteQuiz.copy.见过-但需要有人带着看":
    "I've seen them, but I need someone to walk me through",
  "ui.path.courseRouteQuiz.copy.还没有": "Not yet",
  "ui.path.courseRouteQuiz.copy.重新回答": "Answer again",
  "ui.path.courseRouteQuiz.copy.题": "Question",
  "ui.path.pathDialog.copy.关闭": "Close",
  "ui.path.pathDialog.copy.关闭-也可按-Esc": "Close (or press Esc)",
  "ui.path.pathstats.copy.value0-条真实代码引用": "{{value0}} real code references",
  "ui.path.pathstats.copy.value0-节-约-value1-分钟":
    "{{value0}} lessons · about {{value1}} minutes",
  "ui.path.pathstats.copy.value0-道题": "{{value0}} questions",
  "ui.path.pathstats.copy.从第-1-节开始": "Start from Lesson 1",
  "ui.path.pathstats.copy.先看这一单元讲什么": "See what this unit covers first",
  "ui.path.pathstats.copy.学完这一单元-你能": "After completing this unit, you'll be able to—",
  "ui.path.pathstats.copy.开始": "Start",
  "ui.path.pathstats.copy.开始-学完解锁-value0-个词条":
    "Start · Complete to unlock {{value0}} terms",
  "ui.path.pathstats.copy.读-value0-分钟": "Read for {{value0}} minutes",
  "ui.path.pathstats.copy.这一单元会带你读的真实代码": "Real code you'll read in this unit",
  "ui.practice.mistakeList.copy.value0-道-都订正过了": "{{value0}} questions, all corrected",
  "ui.practice.mistakeList.copy.value0-道还没订正": "{{value0}} questions not yet corrected",
  "ui.practice.mistakeList.copy.你当时答": "You answered",
  "ui.practice.mistakeList.copy.你答过": "You answered:",
  "ui.practice.mistakeList.copy.共错": "· Total incorrect",
  "ui.practice.mistakeList.copy.回到这课": "Back to this lesson",
  "ui.practice.mistakeList.copy.复习里的另一条路": "Another way to review",
  "ui.practice.mistakeList.copy.已于": "· On ",
  "ui.practice.mistakeList.copy.已订正": "Corrected",
  "ui.practice.mistakeList.copy.待订正": "Needs correction",
  "ui.practice.mistakeList.copy.旧题已经从当前课程里撤下-这条记录不再指向一道存在的题":
    "This older question was removed from the current course; this record no longer points to an existing question.",
  "ui.practice.mistakeList.copy.次": "times",
  "ui.practice.mistakeList.copy.正在找回错题内容": "Retrieving missed question content…",
  "ui.practice.mistakeList.copy.正确答案": "Correct answer",
  "ui.practice.mistakeList.copy.空答案": "(No answer)",
  "ui.practice.mistakeList.copy.答错于": "Missed on",
  "ui.practice.mistakeList.copy.答错的题会留在这里-先去上一道练习-错过的地方就有了回头路":
    "Missed questions will stay here. Complete a practice question first, and you'll have a way back to review what you missed.",
  "ui.practice.mistakeList.copy.订正": "Correct",
  "ui.practice.mistakeList.copy.课程内容暂时不可用": "Course content is temporarily unavailable",
  "ui.practice.mistakeList.copy.还没有错题": "No missed questions yet",
  "ui.practice.mistakeList.copy.这个版本不随课程包下发参考答案-题目和你当时的答案都在上面-先自己再想一遍":
    "This version does not include reference answers with the course pack. The question and your answer from that time are above—think through it on your own first.",
  "ui.practice.mistakeList.copy.这本错题本已经清空-之前绊住你的题都被你修好了-它们还留在下面-随时可以再看":
    "This mistake notebook is clear: you've resolved every question that held you back. They remain below so you can review them anytime.",
  "ui.practice.mistakeList.copy.这道练习题": "This practice question",
  "ui.practice.mistakeList.copy.这道题已经换版": "This question has been updated to a new version",
  "ui.practice.mistakeList.copy.道未订正": " uncorrected",
  "ui.practice.mistakeList.copy.都订正好了": "All corrected",
  "ui.practice.mistakeList.copy.错题本": "Mistake notebook, ",
  "ui.practice.mistakeList.copy.错题本-4d8qe0": "Mistake notebook",
  "ui.practice.mistakeList.copy.错题本-全部已订正": "Mistake notebook, all corrected",
  "ui.practice.mistakeList.copy.题目": "Question",
  "ui.practice.practiceOverview.copy.value0-张": "{{value0}} cards",
  "ui.practice.practiceOverview.copy.value0-张到期": "{{value0}} cards due",
  "ui.practice.practiceOverview.copy.个概念": "concepts",
  "ui.practice.practiceOverview.copy.个概念题": "concept questions",
  "ui.practice.practiceOverview.copy.今天复习": "Review today",
  "ui.practice.practiceOverview.copy.今天无到期": "None due today",
  "ui.practice.practiceOverview.copy.今天有-value0-张复习卡到期-先复习它们最有价值-也可以练一道概念判断":
    "You have {{value0}} review cards due today. Reviewing them first offers the most value, or you can practice a true/false concept question.",
  "ui.practice.practiceOverview.copy.今天没有到期复习卡-想巩固-可以练一道判断-答对后会打开完整词条":
    "No review cards are due today. To reinforce what you've learned, you can practice a true/false question; answering correctly unlocks the full entry.",
  "ui.practice.practiceOverview.copy.今天没有到期复习卡-明天有-value0-张回来-想巩固-就练一道概念判断":
    "No review cards are due today, and {{value0}} will return tomorrow. To reinforce what you've learned, practice a true/false concept question.",
  "ui.practice.practiceOverview.copy.今天适合练吗": "Is today a good day to practice?",
  "ui.practice.practiceOverview.copy.先去复习": "Review first",
  "ui.practice.practiceOverview.copy.最近练过": "Recently practiced",
  "ui.practice.practiceOverview.copy.图鉴里还没有带判断题的概念-先去翻翻词条-等题目准备好":
    "The guide doesn't have concepts with true/false questions yet. Browse entries first while questions are being prepared.",
  "ui.practice.practiceOverview.copy.学习-练习-概念图鉴": "Learn / Practice / Concept Guide",
  "ui.practice.practiceOverview.copy.掌握度": "Mastery",
  "ui.practice.practiceOverview.copy.明天复习": "Review tomorrow",
  "ui.practice.practiceOverview.copy.暂未记录-这里只记最近练过-不把一次答对伪装成-已掌握":
    'Not recorded yet. This only tracks recent practice, without pretending a single correct answer means "Mastered."',
  "ui.practice.practiceOverview.copy.概念题分类": "Concept question categories",
  "ui.practice.practiceOverview.copy.没有": "None",
  "ui.practice.practiceOverview.copy.题流来自概念图鉴": "Question stream from Concept Guide",
  "ui.practice.practiceRewardPanel.copy.完整内容": "Full content",
  "ui.practice.practiceRewardPanel.copy.答对后展开完整内容":
    "Answer correctly to view full content",
  "ui.practice.practiceRewardPanel.copy.答对后展开的完整内容":
    "Full content revealed after answering correctly",
  "ui.practice.practiceStream.copy.今天练一道判断": "Practice a true/false question today",
  "ui.practice.practiceStream.copy.去翻翻词条": "Browse entries",
  "ui.practice.practiceStream.copy.开始一道判断": "Start a true/false question",
  "ui.practice.practiceStream.copy.本次已答对-value0": "Correct this session: {{value0}}",
  "ui.practice.practiceStream.copy.概念自己带着判断题-答对一道-展开这一条-题流没有尽头-停下来就行":
    "Concepts come with their own true/false questions. Answer one correctly to reveal the entry. The question stream never ends—just stop whenever you want.",
  "ui.practice.practiceStream.copy.每一条词条自己带着一道判断题-带题的那些会出现在这里":
    "Each entry comes with its own true/false question. Entries with questions will appear here.",
  "ui.practice.practiceStream.copy.练习": "Practice",
  "ui.practice.practiceStream.copy.还没有可以练的题": "No questions available to practice yet",
  "ui.practice.practiceSurface.copy.关卡地图": "← Level map",
  "ui.practice.practiceSurface.copy.概念图解": "Concept diagrams",
  "ui.presence.companionOverlay.copy.一起学的同伴": "Study companions",
  "ui.presence.companionOverlay.copy.在这关": "In this level",
  "ui.presence.companionOverlay.copy.在这门课": "In this course",
  "ui.presence.store.copy.我": "Me",
  "ui.reference.antiPatternIndex.copy.全部": "All",
  "ui.reference.antiPatternIndex.copy.可以搜条目的名字-那句口语抱怨-或直接描述你看见的不对劲-例如-稳稳接住-三张一样大-点了没反应-不必先知道它在":
    'You can search by entry name, everyday complaints, or directly describe what feels wrong—such as "catch reliably", "three equal sizes", or "clicked but no response". You don\'t need to know what it\'s called in the directory first.',
  "ui.reference.antiPatternIndex.copy.搜索反模式": "Search anti-patterns",
  "ui.reference.antiPatternIndex.copy.没有找到-value0-相关的条目":
    'No entries found for "{{value0}}"',
  "ui.reference.antiPatternIndex.copy.目录载入后会出现在这里":
    "The directory will appear here once loaded.",
  "ui.reference.antiPatternIndex.copy.试试-稳稳接住-别再说灯塔":
    'Try "catch reliably" or "stop saying lighthouse"',
  "ui.reference.antiPatternIndex.copy.还没有条目": "No entries yet",
  "ui.reference.collectionIndex.copy.按类别筛选": "Filter by category",
  "ui.reference.conceptIndex.copy.全部": "All",
  "ui.reference.conceptIndex.copy.可以搜中文名-英文名-或者直接把你看见的现象写出来-例如-点了没反应-刷新就没了-怎么退回上一版-不必先知道它叫":
    'You can search by Chinese name, English name, or directly describe what you see—such as "clicked but nothing happens", "gone after refresh", or "how to revert to the previous version". You don\'t need to know what it\'s called first.',
  "ui.reference.conceptIndex.copy.搜索概念": "Search concepts",
  "ui.reference.conceptIndex.copy.没有找到-value0-相关的条目": 'No entries found for "{{value0}}"',
  "ui.reference.conceptIndex.copy.目录载入后会出现在这里":
    "The directory will appear here once loaded.",
  "ui.reference.conceptIndex.copy.试试-点了没反应-怎么退回上一版":
    'Try "clicked but nothing happens" or "how to revert to the previous version"',
  "ui.reference.conceptIndex.copy.还没有条目": "No entries yet",
  "ui.reference.knowledgeNotes.copy.AI-宿主沉淀": "AI host distillations",
  "ui.reference.knowledgeNotes.copy.value0-张卡片可进入复习": "{{value0}} cards ready for review",
  "ui.reference.knowledgeNotes.copy.value0-条固定源码证据":
    "{{value0}} pinned source code evidence items",
  "ui.reference.knowledgeNotes.copy.value0-的知识证据": "Knowledge evidence for {{value0}}",
  "ui.reference.knowledgeNotes.copy.个人理解": "Personal understanding",
  "ui.reference.knowledgeNotes.copy.可复习": "Reviewable",
  "ui.reference.knowledgeNotes.copy.在-AI-宿主中把一次追问保存为知识点后-它会出现在这里":
    "Once you save a follow-up question as a knowledge point in an AI host, it will appear here.",
  "ui.reference.knowledgeNotes.copy.尚未通过源码证据门禁":
    "Has not passed the source code evidence gate.",
  "ui.reference.knowledgeNotes.copy.展开笔记正文与证据": "Expand note body and evidence",
  "ui.reference.knowledgeNotes.copy.已归档": "Archived",
  "ui.reference.knowledgeNotes.copy.已经归档-不再进入复习":
    "Archived; no longer included in review",
  "ui.reference.knowledgeNotes.copy.张派生卡片": "Derived cards",
  "ui.reference.knowledgeNotes.copy.当前没有派生卡片": "No derived cards currently",
  "ui.reference.knowledgeNotes.copy.待重新核验": "Pending re-verification",
  "ui.reference.knowledgeNotes.copy.我的追问-课堂笔记": "My follow-ups / class notes",
  "ui.reference.knowledgeNotes.copy.推论": "Inference",
  "ui.reference.knowledgeNotes.copy.来源已变化-暂停复习": "Source has changed; review paused",
  "ui.reference.knowledgeNotes.copy.没有源码证据": "No source code evidence",
  "ui.reference.knowledgeNotes.copy.源码事实": "Source code fact",
  "ui.reference.knowledgeNotes.copy.版": "Version",
  "ui.reference.knowledgeNotes.copy.第": "· Version",
  "ui.reference.knowledgeNotes.copy.缺证据-未入复习": "Missing evidence; not in review",
  "ui.reference.knowledgeNotes.copy.草稿": "Draft",
  "ui.reference.knowledgeNotes.copy.还没有课堂笔记": "No class notes yet",
  "ui.reference.knowledgeNotes.copy.这是个人理解-可以保留-但不要把它冒充源码事实":
    "This is personal understanding; you can keep it, but do not pass it off as source code fact.",
  "ui.reference.knowledgeNotes.copy.这条知识依据什么": "What is this knowledge based on?",
  "ui.reference.knowledgeNotes.copy.这里保存你与-Grok-等-AI-宿主追问后沉淀的知识-它与经过编排的正式课程分开管理":
    "This stores knowledge distilled from follow-up questions with AI hosts such as Grok; it is managed separately from curated formal courses.",
  "ui.reference.librarySurface.copy.关卡地图": "← Level map",
  "ui.reference.librarySurface.copy.图鉴": "Compendium",
  "ui.reference.librarySurface.copy.收藏": "Saved",
  "ui.reference.librarySurface.copy.概念图解": "Concept diagrams",
  "ui.reference.librarySurface.copy.词义索引": "Glossary index",
  "ui.reference.librarySurface.copy.课堂笔记": "Class notes",
  "ui.reference.librarySurface.copy.防-AI-味儿": "Anti-AI-speak",
  "ui.reference.referencePanel.copy.关闭-也可按-Esc": "Close (or press Esc)",
  "ui.reference.referencePanel.copy.关闭引用": "Close reference",
  "ui.reference.referencePanel.copy.查看完整页": "View full page ↗",
  "ui.reference.referencePanel.copy.证据": "Evidence",
  "ui.reference.referencePanel.copy.词义": "Definition",
  "ui.reference.referencePanel.copy.词库里没有这个词义": "This definition is not in the glossary.",
  "ui.reference.referencePanel.copy.课文": "Lesson text",
  "ui.reference.termIndex.copy.全部": "All",
  "ui.reference.termIndex.copy.可以搜英文词-中文释义-或直接描述你想说的那句话-例如-应用-接口-点开图标就能用-词库会按你的说法去找对应的术":
    "Search by English words, Chinese definitions, or describe what you want to say in your own words, such as “app,” “interface,” or “tap the icon to use it.” The glossary will find matching terms based on your phrasing, so you don't need to know what it's called first.",
  "ui.reference.termIndex.copy.技术用语": "Technical terms",
  "ui.reference.termIndex.copy.搜索词义": "Search definitions",
  "ui.reference.termIndex.copy.没有找到-value0-相关的词义": "No definitions found for “{{value0}}”",
  "ui.reference.termIndex.copy.词义": "Definitions",
  "ui.reference.termIndex.copy.词义索引": "Definition index",
  "ui.reference.termIndex.copy.词库载入后会出现在这里":
    "Entries will appear here once the glossary loads.",
  "ui.reference.termIndex.copy.试试-应用-接口-点开图标就能用":
    "Try “app,” “interface,” or “tap the icon to use it”",
  "ui.reference.termIndex.copy.还没有词义": "No definitions yet",
  "ui.reference.termIndex.copy.通用英语": "General English",
  "ui.review.choiceBlock.copy.判断": "True/False",
  "ui.review.choiceBlock.copy.已答对": "Already answered correctly",
  "ui.review.choiceBlock.copy.提交": "Submit",
  "ui.review.choiceBlock.copy.答对": "Correct",
  "ui.review.choiceBlock.copy.答对了": "✓ Correct",
  "ui.review.choiceBlock.copy.答案解释": "Answer explanation",
  "ui.review.choiceBlock.copy.答错": "Incorrect",
  "ui.review.choiceBlock.copy.继续下一题": "Continue to next question →",
  "ui.review.choiceBlock.copy.还不对": "Still not right",
  "ui.review.choiceBlock.copy.选项": "Options",
  "ui.review.recapPrompt.copy.你的复述": "Your recap",
  "ui.review.recapPrompt.copy.保存为复习卡": "Save as review card",
  "ui.review.recapPrompt.copy.到期时它会回来-请再讲一遍":
    "When it's due, it will return for you to explain again.",
  "ui.review.recapPrompt.copy.在这里写你的复述": "Write your recap here…",
  "ui.review.recapPrompt.copy.复习卡已保存": "Review card saved",
  "ui.review.recapPrompt.copy.复习卡已保存-但界面没有刷新-请重新加载页面":
    "Review card saved, but the screen did not refresh. Please reload the page.",
  "ui.review.recapPrompt.copy.复习卡没有保存": "Review card not saved",
  "ui.review.recapPrompt.copy.复习卡没有写入云端缓存":
    "Review card was not written to the cloud cache",
  "ui.review.recapPrompt.copy.本单元能力句": "Unit can-do statement",
  "ui.review.recapPrompt.copy.正在保存": "Saving…",
  "ui.review.recapPrompt.copy.讲一遍": "Explain it",
  "ui.review.recapPrompt.copy.请用自己的话-讲给一个完全不知道这件事的人听":
    "In your own words, explain it to someone who knows nothing about it.",
  "ui.review.recapPrompt.copy.课后复习": "Post-lesson review",
  "ui.review.reviewCard.copy.下一次安排": "Next scheduled:",
  "ui.review.reviewCard.copy.今天还剩": "Remaining today",
  "ui.review.reviewCard.copy.以前的复述": "Previous recap (",
  "ui.review.reviewCard.copy.你以前答过": "You previously answered",
  "ui.review.reviewCard.copy.你的回答": "Your answer",
  "ui.review.reviewCard.copy.先写下自己的答案-非空后才能揭示":
    "Write your own answer first; it must not be empty before you can reveal.",
  "ui.review.reviewCard.copy.参考答案": "Reference answer",
  "ui.review.reviewCard.copy.困难": "Hard",
  "ui.review.reviewCard.copy.在这里写你的复述": "Write your recap here…",
  "ui.review.reviewCard.copy.复习服务尚未接通": "Review service is not connected",
  "ui.review.reviewCard.copy.复习结果已保存": "Review results saved",
  "ui.review.reviewCard.copy.复制失败-剪贴板不可用": "Copy failed: clipboard is unavailable",
  "ui.review.reviewCard.copy.已复制讲解包": "Explanation pack copied",
  "ui.review.reviewCard.copy.张-评分后自动换下一张":
    "cards · Automatically advances to next card after rating",
  "ui.review.reviewCard.copy.揭示答案": "Reveal answer",
  "ui.review.reviewCard.copy.暂时无法保存复习结果": "Unable to save review results right now",
  "ui.review.reviewCard.copy.暂时无法揭示答案": "Unable to reveal answer right now",
  "ui.review.reviewCard.copy.本次与以前的复述": "Current and previous retellings",
  "ui.review.reviewCard.copy.查看以前的复述": "View previous retellings",
  "ui.review.reviewCard.copy.根据回忆难度评分": "Rate how hard it was to recall",
  "ui.review.reviewCard.copy.次": "times)",
  "ui.review.reviewCard.copy.次-a5jtgs": "times",
  "ui.review.reviewCard.copy.正在核对": "Checking…",
  "ui.review.reviewCard.copy.正在检查会员权益": "Checking membership benefits…",
  "ui.review.reviewCard.copy.正在记录": "Recording…",
  "ui.review.reviewCard.copy.答的是旧版": "Answered an older version",
  "ui.review.reviewCard.copy.简单": "Easy",
  "ui.review.reviewCard.copy.良好": "Good",
  "ui.review.reviewCard.copy.让-AI-讲讲这张卡": "Ask AI to explain this card",
  "ui.review.reviewCard.copy.讲一遍": "Explain it",
  "ui.review.reviewCard.copy.评分已保存-但界面没能刷新-请重新加载页面":
    "Rating saved, but the page couldn't refresh. Please reload the page.",
  "ui.review.reviewCard.copy.请用自己的话-讲给一个完全不知道这件事的人听":
    "In your own words, explain this to someone who knows nothing about it.",
  "ui.review.reviewCard.copy.贴到任意-AI-宿主-它只负责讲解-下面这四个按钮问的是-你回忆得费不费劲-只有你答得了":
    "Paste into any AI host. It only handles explanations—the four buttons below ask how hard it was to recall, and only you can answer that.",
  "ui.review.reviewCard.copy.还没有更早的复述": "No earlier retellings yet.",
  "ui.review.reviewCard.copy.这四个按钮是什么意思": "What do these four buttons mean?",
  "ui.review.reviewCard.copy.这次复述": "This retelling",
  "ui.review.reviewCard.copy.通过答题复习": "Review by answering questions",
  "ui.review.reviewCard.copy.重来": "Again",
  "ui.review.reviewCard.copy.重试揭示": "Retry reveal",
  "ui.review.reviewCard.copy.重试查看": "Retry view",
  "ui.review.reviewempty.copy.今天没有到期卡片": "No cards due today",
  "ui.review.reviewempty.copy.今天的复习已经清空": "Today's reviews are all done.",
  "ui.review.reviewempty.copy.学一节新课-它会掉落新的卡片-明天就有事做了":
    "Take a new lesson—it will drop new cards, so you'll have something to do tomorrow.",
  "ui.review.reviewinterval.copy.value0-分钟": "{{value0}} minutes",
  "ui.review.reviewinterval.copy.value0-天": "{{value0}} days",
  "ui.review.reviewinterval.copy.value0-小时": "{{value0}} hours",
  "ui.review.reviewinterval.copy.马上": "Right away",
  "ui.review.schedulerports.copy.复习卡内容已更新-请重新加载":
    "Review card content has been updated. Please reload",
  "ui.review.schedulerports.copy.复习结果没有写入云端缓存":
    "Review results were not written to the cloud cache",
  "ui.review.schedulerports.copy.这类复习卡还不能在这里复习":
    "This type of review card cannot be reviewed here yet",
  "ui.review.vocabularyReview.copy.一眼就懂": "Understood at a glance",
  "ui.review.vocabularyReview.copy.个待复习": "to review",
  "ui.review.vocabularyReview.copy.个词": "words",
  "ui.review.vocabularyReview.copy.今天已复习": "Reviewed today",
  "ui.review.vocabularyReview.copy.勉强想起": "Barely remembered",
  "ui.review.vocabularyReview.copy.复习中": "Reviewing",
  "ui.review.vocabularyReview.copy.想起来了": "Remembered",
  "ui.review.vocabularyReview.copy.我想好了-看释义": "I'm ready, show definition",
  "ui.review.vocabularyReview.copy.根据回忆难度评分": "Rate how hard it was to recall",
  "ui.review.vocabularyReview.copy.没想起来": "Couldn't remember",
  "ui.review.vocabularyReview.copy.生词": "New words ·",
  "ui.review.vocabularyReview.copy.生词复习服务尚未接通":
    "Vocabulary review service is not connected",
  "ui.review.vocabularyReview.copy.评分失败": "Rating failed",
  "ui.review.vocabularyReview.copy.还不熟": "Still unfamiliar",
  "ui.shell.appShell.copy.展开上下文": "Expand context",
  "ui.shell.appShell.copy.展开导航": "Expand navigation",
  "ui.shell.appShell.copy.收起": "Collapse",
  "ui.sound.soundToggle.copy.关掉声音": "Turn off sound",
  "ui.sound.soundToggle.copy.打开声音": "Turn on sound",
  "ui.theme.copy.按设备的浅色-深色设置": "Match device light / dark setting.",
  "ui.theme.copy.暖色纸面-适合明亮环境": "Warm paper, suitable for bright environments.",
  "ui.theme.copy.浅色": "Light",
  "ui.theme.copy.深色": "Dark",
  "ui.theme.copy.深色纸面-适合昏暗环境": "Dark paper, suitable for dim environments.",
  "ui.theme.copy.跟随系统": "Match system",
  "ui.today.todaySection.copy.value0-还剩-value1-关": "{{value0}} · {{value1}} levels remaining",
  "ui.today.todaySection.copy.今天-从回忆开始": "Today, start with recall",
  "ui.today.todaySection.copy.今天到期的复习卡片": "Review cards due today",
  "ui.today.todaySection.copy.今天的第一件事": "First thing today",
  "ui.today.todaySection.copy.复习-value0-张到期": "Review · {{value0}} due",
  "ui.today.todaySection.copy.复习-明天-value0-张": "Review · {{value0}} tomorrow",
  "ui.today.todaySection.copy.开始学习": "Start learning",
  "ui.today.todaySection.copy.有学习数据暂时无法使用":
    "Some learning data is temporarily unavailable",
  "ui.today.todaySection.copy.继续学习": "Continue learning",
  "ui.today.todaySection.copy.课程负责建立理解-卡片只负责把重要知识留在长期记忆里":
    "Courses build understanding; cards only keep key knowledge in long-term memory.",
  "ui.today.todaySection.copy.课程这边暂时没有待办": "No course tasks for now.",
  "ui.view.lessonview.copy.1-指出我的回答和参考答案之间-实质-的差距-措辞不同不算":
    "1. Point out any **substantive** gaps between my answer and the reference answer (different wording doesn't count).",
  "ui.view.lessonview.copy.2-如果我以前答过-说说我的理解有没有变化":
    "2. If I've answered before, let me know if my understanding has changed.",
  "ui.view.lessonview.copy.3-补一个能帮我记住它的具体例子或类比":
    "3. Add a concrete example or analogy to help me remember it.",
  "ui.view.lessonview.copy.value0-不在书架上": "{{value0}} (not on bookshelf)",
  "ui.view.lessonview.copy.不要给我打分-也不要说我该选-困难-还是-良好-那个我自己判断":
    "Do not grade me, and do not tell me whether to choose 'Hard' or 'Good'—I'll judge that myself.",
  "ui.view.lessonview.copy.从value0开始-主攻路线-value1-门":
    "Start from {{value0}} · Main track: {{value1}} courses",
  "ui.view.lessonview.copy.卡片问题-value0": "## Card Question\n{{value0}}",
  "ui.view.lessonview.copy.参考答案-value0": "## Reference Answer\n{{value0}}",
  "ui.view.lessonview.copy.尚未开始": "Not started",
  "ui.view.lessonview.copy.已完成": "Completed",
  "ui.view.lessonview.copy.我以前的回答-value0": "## My Previous Answer\n{{value0}}",
  "ui.view.lessonview.copy.我在用间隔重复复习一张卡片-想请你-讲解-不要判分":
    "I'm reviewing a card using spaced repetition, and I'd like you to **explain** it, not grade it.",
  "ui.view.lessonview.copy.我这次的回答-value0": "## My Answer This Time\n{{value0}}",
  "ui.view.lessonview.copy.请": "Please:",
  "ui.view.lessonview.copy.课文已确认-练习待完成": "Lesson text confirmed · Exercises pending",
  "ui.view.lessonview.copy.课文有新版-待阅读确认": "New lesson text available · Review to confirm",
  "ui.view.lessonview.copy.进行中-value0": "In progress · {{value0}}%",
  "ui.world.mapControlsHint.copy.双指缩放": "Pinch to zoom",
  "ui.world.mapControlsHint.copy.拖动平移": "Drag to pan",
  "ui.world.mapControlsHint.copy.滚轮缩放": "Scroll to zoom",
  "ui.world.mapControlsHint.copy.点岛进入": "Tap island to enter",
} satisfies Partial<MessageCatalog>;
