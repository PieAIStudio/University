export const messages = {
  "play.program.boardTitle": "看好路线，再让它出发",
  "play.program.boardNote": "前进跟着机器人的朝向；转弯只换朝向，不换位置。",
  "play.program.programTitle": "你的指令",
  "play.program.budget": "{{count}} / {{maximum}} 条",
  "play.program.budgetNote": "最多 {{maximum}} 条指令，每条可重复 1–{{repeat}} 次。",
  "play.program.budgetFull": "指令位用满了。增加重复次数，或删掉不需要的一条。",
  "play.program.emptyTitle": "它在等你的第一条指令",
  "play.program.emptyBody": "点「前进」加一条，再把次数改成你需要的步数。",
  "play.program.forward": "前进",
  "play.program.left": "左转",
  "play.program.right": "右转",
  "play.program.addCommand": "添加{{command}}指令",
  "play.program.repeat": "重复",
  "play.program.repeatLabel": "第 {{command}} 条指令的重复次数",
  "play.program.times": "次",
  "play.program.moveUp": "把第 {{command}} 条指令上移",
  "play.program.moveDown": "把第 {{command}} 条指令下移",
  "play.program.remove": "删除第 {{command}} 条指令",
  "play.program.clear": "清空",
  "play.program.run": "运行指令",
  "play.program.runAgain": "再跑一次",
  "play.program.running": "正在运行",
  "play.program.starting": "准备出发，先看它的朝向。",
  "play.program.editCommand": "修改第 {{command}} 条指令",
  "play.program.backToEditor": "回到指令",
  "play.program.stop": "停下重改",
  "play.program.finishNow": "直接看结果",
  "play.program.start": "起点",
  "play.program.goal": "终点",
  "play.program.checkpoint": "检查点",
  "play.program.wall": "障碍",
  "play.program.visited": "已到过",
  "play.program.north": "上",
  "play.program.east": "右",
  "play.program.south": "下",
  "play.program.west": "左",
  "play.program.pose": "现在在 {{cell}}，朝{{direction}}",
  "play.program.startPose": "从 {{cell}} 出发，朝{{direction}}",
  "play.program.checkpointCount": "检查点 {{visited}} / {{total}}",
  "play.program.stepCount": "执行 {{step}} / {{total}} 步",
  "play.program.ready": "路线准备好，就点「运行指令」。",
  "play.program.edited": "指令已更新，机器人回到起点。可以再跑一次。",
  "play.program.stopped": "已经停下并回到起点，指令保留着。",
  "play.program.currentCommand": "第 {{command}} 条「{{operation}}」，第 {{repeat}} 次",
  "play.program.mapDescription":
    "场地 {{width}} 列、{{height}} 行，A1 在左上角。起点 {{start}}，朝{{direction}}；终点 {{goal}}；检查点 {{checkpoints}}；障碍 {{walls}}。",
  "play.program.none": "无",
  "play.program.traceTitle": "逐步轨迹 · {{count}} 步",
  "play.program.traceStep":
    "{{step}}. 第 {{command}} 条·第 {{repeat}} 次：{{operation}}，在 {{cell}} 朝{{direction}}",
  "play.program.traceBlocked":
    "{{step}}. 第 {{command}} 条·第 {{repeat}} 次：{{operation}}被挡住，留在 {{cell}} 朝{{direction}}",
  "play.program.traceCheckpoint": " · 到过 {{count}} 个检查点",
  "play.program.success":
    "经过了全部 {{checkpoints}} 个检查点，并停在终点。{{commands}} 条指令，执行了 {{steps}} 步。",
  "play.program.empty": "先加一条指令，再让机器人出发。",
  "play.program.invalidActivity": "这张场地的配置不完整，暂时无法运行。可以先换一个情境。",
  "play.program.invalidCommand":
    "第 {{command}} 条指令不合法。重复次数要是 1–{{maximum}} 之间的整数。",
  "play.program.overBudget":
    "这段程序用了 {{count}} 条指令，场地最多允许 {{maximum}} 条。试着合并连续的动作。",
  "play.program.hitWall":
    "第 {{command}} 条指令、第 {{repeat}} 次：{{cell}} 有障碍，机器人停在 {{position}}。试着提前转弯。",
  "play.program.outOfBounds":
    "第 {{command}} 条指令、第 {{repeat}} 次要走出场地，机器人停在 {{position}}。少走一步，或先转弯。",
  "play.program.missingCheckpoints":
    "到过 {{visited}} / {{total}} 个检查点。还要经过 {{missing}}，最后停在 {{goal}}。",
  "play.program.notAtGoal": "检查点都到过了，最后却停在 {{position}}。还需要走到终点 {{goal}}。",
  "play.program.source": "MDN：循环与迭代",
  "play.program.delivery.title": "绕街送件",
  "play.program.delivery.brief":
    "小邮差只会听三种指令。替它绕过街区，把两处包裹送到，再回右上角的邮局。",
  "play.program.delivery.goal": "经过两个检查点，最后停在终点；最多用 5 条指令。",
  "play.program.delivery.takeaway":
    "把「前进两次」写成一条重复指令，省的是程序的长度，实际的两步仍然一步不少。转弯只改变接下来前进的方向。",
  "play.program.delivery.hint":
    "起点朝上。先到 A3，再沿第三行走到最右边；最后朝上走。连续前进可以合成一条。",
  "play.program.irrigation.title": "浇完苗圃再收工",
  "play.program.irrigation.brief":
    "灌溉机器人从左下角出发。三块苗圃都需要水，右上角是充电座；到终点之前，别漏掉任何一块。",
  "play.program.irrigation.goal": "经过三个检查点，最后停在终点；最多用 7 条指令。",
  "play.program.irrigation.takeaway":
    "一个程序可以同时有多个条件：经过所有苗圃、避开障碍、回到充电座。只满足其中一个，还不能算完成。",
  "play.program.irrigation.hint":
    "先沿底行去 C5，朝上到 C2，再朝右到 F2。每个直线段用一条重复前进；留一条指令走向充电座。",
} as const;
