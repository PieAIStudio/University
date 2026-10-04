export const messages = {
  "play.difficulty.sort.intro": "先只分两格：你是在给页面加一样东西，还是在改它长什么样。",
  "play.difficulty.sort.practice": "三格都用上：加东西、改长相、改点了之后发生的事。",
  "play.difficulty.sort.challenge": "多一格「这三个文件都不管」。有些改动，答案不在这三层里。",
  "play.sort.files.title": "这件事该开哪个文件？",
  "play.sort.files.brief":
    "把你想改的事，放进真正负责它的那一格。放错了，会告诉你那一格为什么装不下它。",
  "play.sort.files.goal":
    "分清「页面上有什么」「它长什么样」「点了会怎样」，并据此找到该开的文件。",
  "play.sort.files.takeaway":
    "加东西或改文字看 index.html，改颜色和间距看 style.css，改点击之后发生的事看 main.js。",
  "play.sort.files.hint":
    "先问自己：这样东西现在页面上有没有？如果有，你是在改它的样子，还是改它的反应？",
  "play.sort.files.source": "一个网页最少由哪几个文件组成",
  "play.sort.files.question": "你要改的这件事，主要属于哪一层？",
  "play.sort.files.bucket.html": "页面上有什么（index.html）",
  "play.sort.files.bucket.htmlNote": "文字、按钮、图片这些页面上摆着的东西，写在这里。",
  "play.sort.files.bucket.css": "长什么样（style.css）",
  "play.sort.files.bucket.cssNote": "颜色、间距、圆角、大小这些外观，写在这里。",
  "play.sort.files.bucket.js": "点了会怎样（main.js）",
  "play.sort.files.bucket.jsNote": "点击、选择之后要发生的事，写在这里。",
  "play.sort.files.bucket.elsewhere": "这三个文件都不管",
  "play.sort.files.bucket.elsewhereNote": "有些改动不在这三层里。认出来，比硬塞进一格有用。",
  "play.sort.files.addLine": "在页面上再放一行说明文字",
  "play.sort.files.addLineDetail": "这行字现在页面上还没有。",
  "play.sort.files.addLineWhy": "你是在让一行本来不存在的字出现，先开 index.html。",
  "play.sort.files.addLineNot":
    "它当然也要摆在某个位置，但眼下的事是让它先存在。style.css 只能改已经有的东西长什么样。",
  "play.sort.files.renameButton": "把按钮上的字换成另一句",
  "play.sort.files.renameButtonDetail": "按钮还是那个按钮，只换它显示的文字。",
  "play.sort.files.renameButtonWhy": "你改的是页面上本来就摆着的文字，去 index.html。",
  "play.sort.files.renameButtonNot":
    "按钮点下去要做什么没有变。main.js 管的是点了之后发生的事，不是按钮上印着几个字。",
  "play.sort.files.darkerButton": "把按钮的颜色调深一点",
  "play.sort.files.darkerButtonDetail": "按钮和它的文字都不动，只换颜色。",
  "play.sort.files.darkerButtonWhy": "东西还在，变的只是它看起来的样子，去 style.css。",
  "play.sort.files.darkerButtonNot":
    "你没有往页面上加什么，也没有拿掉什么。index.html 管的是有没有，不是好不好看。",
  "play.sort.files.widerGap": "把两个按钮之间拉开一点",
  "play.sort.files.widerGapDetail": "两个按钮都还在，只是挨得太近了。",
  "play.sort.files.widerGapWhy": "间距是长相的一部分，去 style.css。",
  "play.sort.files.widerGapNot": "按钮的个数和顺序都没变，所以这件事不在 index.html 里。",
  "play.sort.files.messageAfterClick": "点完按钮才显示「处理好了」",
  "play.sort.files.messageAfterClickDetail": "这句话不是一打开就有，要点过之后才出现。",
  "play.sort.files.messageAfterClickWhy": "你改的是点击之后触发的那件事，去 main.js。",
  "play.sort.files.messageAfterClickNot":
    "最后确实会多出一行字，但它不是页面一打开就摆在那儿的固定内容。",
  "play.sort.files.disableUntilPicked": "没选照片之前，按钮点不动",
  "play.sort.files.disableUntilPickedDetail": "按钮一直在，但选了照片之后才允许点。",
  "play.sort.files.disableUntilPickedWhy":
    "什么时候能点、什么时候不能点，是一条要判断的规则，去 main.js。",
  "play.sort.files.disableUntilPickedNot":
    "把它画成灰的是 style.css 的事，但「灰着的时候真的点不动」得有人去判断。",
  "play.sort.files.swapModel": "换一个更准的模型来抠图",
  "play.sort.files.swapModelDetail": "页面、样子、点击都不动，只想换掉那个做判断的东西。",
  "play.sort.files.swapModelWhy":
    "模型是页面另外去取的一份东西，不住在这三个文件里。这一格就是给这种改动留的。",
  "play.sort.files.swapModelNot":
    "main.js 里会写「去取哪一个」，但模型本身不在 main.js 里——改名字和换东西是两件事。",
} as const;
