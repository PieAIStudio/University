export const messages = {
  "play.difficulty.sort.intro":
    "Two bins only: are you adding something to the page, or changing how it looks?",
  "play.difficulty.sort.practice":
    "All three bins: what is on the page, how it looks, and what happens on a click.",
  "play.difficulty.sort.challenge":
    "A fourth bin for changes none of the three files own. Not everything is one of them.",
  "play.sort.files.title": "Which file do you open for this?",
  "play.sort.files.brief":
    "Put each change in the file that really owns it. A miss tells you why that bin does not hold it.",
  "play.sort.files.goal":
    "Tell apart what is on the page, how it looks, and what happens on a click — and find the file from that.",
  "play.sort.files.takeaway":
    "Adding or rewording goes in index.html, colour and spacing in style.css, what happens after a click in main.js.",
  "play.sort.files.hint":
    "Ask first: is this thing already on the page? If it is, are you changing how it looks or how it responds?",
  "play.sort.files.source": "The files a web page is made of",
  "play.sort.files.question": "Which layer does this change mostly belong to?",
  "play.sort.files.bucket.html": "What is on the page (index.html)",
  "play.sort.files.bucket.htmlNote": "Text, buttons and images — the things the page holds.",
  "play.sort.files.bucket.css": "How it looks (style.css)",
  "play.sort.files.bucket.cssNote": "Colour, spacing, corners, size — appearance.",
  "play.sort.files.bucket.js": "What happens on a click (main.js)",
  "play.sort.files.bucket.jsNote": "What follows a click or a choice.",
  "play.sort.files.bucket.elsewhere": "None of these three files",
  "play.sort.files.bucket.elsewhereNote":
    "Some changes live outside all three. Spotting one beats forcing it into a bin.",
  "play.sort.files.addLine": "Put another line of explanation on the page",
  "play.sort.files.addLineDetail": "That line is not on the page at all yet.",
  "play.sort.files.addLineWhy": "You are making a line exist that did not. Open index.html first.",
  "play.sort.files.addLineNot":
    "It will need a position too, but the job right now is making it exist. style.css only changes how existing things look.",
  "play.sort.files.renameButton": "Change the wording on a button",
  "play.sort.files.renameButtonDetail": "Same button, different words on it.",
  "play.sort.files.renameButtonWhy": "You are changing text the page already holds, so index.html.",
  "play.sort.files.renameButtonNot":
    "What the button does when clicked has not changed, and that is what main.js owns.",
  "play.sort.files.darkerButton": "Make a button''s colour darker",
  "play.sort.files.darkerButtonDetail": "Button and wording stay; only the colour changes.",
  "play.sort.files.darkerButtonWhy":
    "The thing is still there; only how it looks changed, so style.css.",
  "play.sort.files.darkerButtonNot":
    "You added nothing and removed nothing. index.html owns whether something is there, not how good it looks.",
  "play.sort.files.widerGap": "Push two buttons further apart",
  "play.sort.files.widerGapDetail": "Both buttons stay; they are just too close together.",
  "play.sort.files.widerGapWhy": "Spacing is part of how it looks, so style.css.",
  "play.sort.files.widerGapNot":
    "The number of buttons and their order did not change, so this is not in index.html.",
  "play.sort.files.messageAfterClick": "Show a done message only after the button is clicked",
  "play.sort.files.messageAfterClickDetail":
    "The line is not there on load; it appears after a click.",
  "play.sort.files.messageAfterClickWhy": "You are changing what a click sets off, so main.js.",
  "play.sort.files.messageAfterClickNot":
    "A line of text does end up on screen, but it is not fixed content the page holds from the start.",
  "play.sort.files.disableUntilPicked": "Keep the button unclickable until a photo is chosen",
  "play.sort.files.disableUntilPickedDetail":
    "The button is always there, but only becomes usable after a photo is picked.",
  "play.sort.files.disableUntilPickedWhy":
    "When it may and may not be clicked is a rule somebody has to decide, so main.js.",
  "play.sort.files.disableUntilPickedNot":
    "Drawing it greyed out is style.css, but something still has to make the grey one actually refuse the click.",
  "play.sort.files.swapModel": "Swap in a more accurate model for the cut-out",
  "play.sort.files.swapModelDetail":
    "Page, look and clicks all stay; only the thing doing the judging changes.",
  "play.sort.files.swapModelWhy":
    "The model is something the page fetches separately. It does not live in any of the three files — this bin is for exactly that.",
  "play.sort.files.swapModelNot":
    "main.js says which one to fetch, but the model itself is not in main.js. Changing a name and swapping a thing are different jobs.",
} as const;
