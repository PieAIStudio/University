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
  "play.sort.files.darkerButton": "Make a button's colour darker",
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

  "play.extra.hunt.rule": "The specification",
  "play.extra.hunt.program": "The running program",
  "play.extra.hunt.inputRange":
    "Test values from {{min}} to {{max}} {{unit}}, including both ends.",
  "play.extra.hunt.run": "Run this input",
  "play.extra.hunt.expected": "The specification promises",
  "play.extra.hunt.actual": "The program produces",
  "play.extra.hunt.waiting": "Waiting for a test",
  "play.extra.hunt.yes": "Yes",
  "play.extra.hunt.no": "No",
  "play.extra.hunt.equal": "Results agree",
  "play.extra.hunt.different": "A disagreement",
  "play.extra.hunt.found":
    "For input {{input}}, the specification promises {{expected}}, but the program produces {{actual}}. This counterexample reproduces the problem.",
  "play.extra.hunt.same":
    "Both results are {{output}} for this input. It does not disprove the program yet. Try another part of the range.",
  "play.extra.hunt.empty": "Enter a number before running the test.",
  "play.extra.hunt.notFinite": "Enter a finite number.",
  "play.extra.hunt.outOfRange": "The input must be between {{min}} and {{max}} {{unit}}.",
  "play.extra.hunt.invalidActivity": "This experiment has an invalid numeric range and cannot run.",
  "play.extra.hunt.explored": "Inputs you have explored",
  "play.extra.hunt.exploredEmpty": "Tests leave a point here",
  "play.extra.hunt.blackbox": "Black-box test bench",
  "play.extra.hunt.blackboxBrief": "Choose an input. See whether it keeps its promise.",
  "play.extra.hunt.selectInput": "Pick a test value on the number line",
  "play.extra.hunt.precisionNote":
    "Drag to choose a whole number, or enter a precise decimal in the box.",
  "play.extra.hunt.testCount": "{{count}} test points recorded",
  "play.extra.hunt.ready": "Ready? Run a test and compare both results.",
  "play.extra.hunt.testedInput": "Input tested: {{input}}",
  "play.extra.hunt.previousInput":
    "The new input has not run yet. These are still the results for {{input}}.",
  "play.extra.hunt.openImplementation": "Look inside",
  "play.extra.hunt.implementationNote":
    "You can inspect the implementation here, or close it and keep finding counterexamples through experiments.",
  "play.extra.hunt.history": "Test history",
  "play.extra.hunt.testNumber": "Test {{number}}",
  "play.extra.hunt.testSummary": "Input {{input}}; expected {{expected}}; actual {{actual}}.",
  "play.extra.dispatch.served": "Served",
  "play.extra.dispatch.cost": "Cost used",
  "play.extra.dispatch.progress": "Request progress",
  "play.extra.dispatch.costProgress": "Budget used",
  "play.extra.dispatch.costValue": "{{cost}} / {{budget}}",
  "play.extra.dispatch.requestNumber": "Request {{number}} / {{total}}",
  "play.extra.dispatch.sendTo": "Send this request to",
  "play.extra.dispatch.laneCost": "Cost {{cost}}",
  "play.extra.dispatch.warm": "An identical resource is already cached. You can reuse it now.",
  "play.extra.dispatch.cold":
    "This resource is not cached yet. A correct first delivery will leave a copy.",
  "play.extra.dispatch.fresh":
    "This request needs a fresh result. It cannot use or create a cached copy.",
  "play.extra.dispatch.cacheRack": "Copies ready to reuse",
  "play.extra.dispatch.cacheEmpty":
    "Empty for now. Reusable resources appear here after a correct delivery.",
  "play.extra.dispatch.cacheReady": "Ready to reuse",
  "play.extra.dispatch.cacheUnavailable": "No matching copy yet",
  "play.extra.dispatch.cacheForbidden": "This request cannot be cached",
  "play.extra.dispatch.cacheMiss":
    "There is no matching cached copy yet. Use a lane that can produce this resource first.",
  "play.extra.dispatch.noCache":
    "This request needs a fresh result, so the cache cannot serve it. {{why}}",
  "play.extra.dispatch.wrongLane": "“{{lane}}” cannot serve this request. {{why}}",
  "play.extra.dispatch.invalidLane": "This lane has an invalid configuration. Try another lane.",
  "play.extra.dispatch.delivered": "Served by “{{lane}}” at a cost of +{{cost}}.",
  "play.extra.dispatch.createdCache": "A matching cached copy is now available for later requests.",
  "play.extra.dispatch.usedCache": "Reused an existing result at no additional cost.",
  "play.extra.dispatch.success":
    "All {{count}} requests were served correctly. Cost: {{spent}}; budget: {{budget}}. You reused an existing result {{hits}} times.",
  "play.extra.dispatch.overBudget":
    "Cost {{spent}} exceeds the budget of {{budget}}. Restart this round and route repeat requests to copies that are already cached.",
  "play.extra.dispatch.completeTitle": "Every request delivered",
  "play.extra.dispatch.overBudgetTitle": "The budget is exceeded",
  "play.extra.dispatch.history": "Delivery history",
  "play.extra.dispatch.historyEmpty": "Choose a lane to make your first delivery.",
  "play.extra.dispatch.upNext": "Coming next",
  "play.extra.dispatch.timed": "Timed challenge",
  "play.extra.dispatch.untimed": "No time limit in practice mode",
  "play.extra.dispatch.timeLeft": "{{seconds}} seconds left",
  "play.extra.dispatch.pause": "Pause",
  "play.extra.dispatch.resume": "Resume timer",
  "play.extra.dispatch.paused":
    "Paused with your progress saved. Return to this page and resume when you are ready.",
  "play.extra.dispatch.expired": "Time is up. Your deliveries and cached copies are still here.",
  "play.extra.dispatch.continuePractice": "Continue without a timer",
  "play.extra.dispatch.retryTimed": "Restart the timed challenge",
  "play.extra.dispatch.timerHelp":
    "The timer starts only when enabled. Pause whenever you like; leaving this page pauses it automatically.",
  "play.extra.sample.shipping.title": "Does this shipping system keep its promise?",
  "play.extra.sample.shipping.brief":
    "The shop lets a small program decide who gets free shipping. Try different order totals and check whether it follows the shop's rule.",
  "play.extra.sample.shipping.goal":
    "Find a valid order total that makes the promised and actual results disagree.",
  "play.extra.sample.shipping.takeaway":
    "“At least” includes equality. Test both sides of a boundary and the boundary itself.",
  "play.extra.sample.shipping.hint":
    "Most totals will look fine. Consider whether “at least” and “more than” mean the same thing at their boundary.",
  "play.extra.sample.shipping.input": "Order total",
  "play.extra.sample.shipping.unit": "credits",
  "play.extra.sample.shipping.rule":
    "Orders of at least 100 credits get free shipping. Smaller orders do not.",
  "play.extra.sample.shipping.program": "freeShipping = orderTotal > 100",
  "play.extra.sample.shipping.output": "Free shipping?",
  "play.extra.sample.shipping.source": "MDN · Greater than or equal",
  "play.extra.sample.volume.title": "The player's volume gatekeeper",
  "play.extra.sample.volume.brief":
    "The player promises to keep its output in a safe range. Give it different requested volumes and look for a case it missed.",
  "play.extra.sample.volume.goal":
    "Create an input that makes the program produce a value outside its promised range.",
  "play.extra.sample.volume.takeaway":
    "A bounded range needs both ends protected. Capping the maximum still lets negative values through.",
  "play.extra.sample.volume.hint":
    "A working upper limit does not protect the whole range. Approach the allowed output range from the other direction.",
  "play.extra.sample.volume.input": "Requested volume",
  "play.extra.sample.volume.unit": "%",
  "play.extra.sample.volume.rule":
    "Requests below 0 produce 0; requests above 100 produce 100; values in between remain unchanged.",
  "play.extra.sample.volume.program": "volume = Math.min(100, requestedVolume)",
  "play.extra.sample.volume.output": "Output volume",
  "play.extra.sample.volume.source": "MDN · Math.max and lower bounds",
  "play.extra.sample.web.title": "A small website's dispatch desk",
  "play.extra.sample.web.brief":
    "Posters, styles, prices, and stock requests keep arriving. Identical files can be reused; live data must be fetched again.",
  "play.extra.sample.web.goal": "Serve all 7 requests correctly with a total cost of at most 8.",
  "play.extra.sample.web.takeaway":
    "A cache reuses identical results that are permitted to be reused. A copy must exist before a hit; fresh data needs the live lane.",
  "play.extra.sample.web.hint":
    "Prepare copies of static resources, then recognize their repeat requests. The live lane can serve files too, but costs more.",
  "play.extra.sample.web.cache": "Cache",
  "play.extra.sample.web.cacheNote": "Reuse an identical resource already on hand.",
  "play.extra.sample.web.static": "File service",
  "play.extra.sample.web.staticNote": "Deliver existing images and styles, leaving a cached copy.",
  "play.extra.sample.web.live": "Live service",
  "play.extra.sample.web.liveNote": "Fetch current data, or serve a file at a higher cost.",
  "play.extra.sample.web.hero": "Event poster",
  "play.extra.sample.web.heroDetail": "The fixed file poster-v1 has not changed.",
  "play.extra.sample.web.heroRepeat": "Another visitor wants the same poster",
  "play.extra.sample.web.fileWhy":
    "This is an existing file. Both file and live services can provide it; a cached copy can be reused once available.",
  "play.extra.sample.web.price": "The current product price",
  "play.extra.sample.web.priceDetail":
    "This request explicitly requires the latest price. An old result cannot be reused.",
  "play.extra.sample.web.liveWhy":
    "This request requires a current result, which only the live service can provide.",
  "play.extra.sample.web.css": "Page styles",
  "play.extra.sample.web.cssDetail": "Every visitor uses the identical fixed file theme-v2.",
  "play.extra.sample.web.cssRepeat": "The same page styles are requested again",
  "play.extra.sample.web.stock": "The current stock count",
  "play.extra.sample.web.stockDetail": "Stock may just have changed. Fetch the latest value.",
  "play.extra.sample.web.source": "MDN · HTTP caching",
  "play.extra.sample.video.title": "A short film's reuse desk",
  "play.extra.sample.video.brief":
    "Several shots need identical assets. Reuse prepared results, but query export progress afresh.",
  "play.extra.sample.video.goal":
    "Serve all 7 asset requests correctly with a total cost of at most 8.",
  "play.extra.sample.video.takeaway":
    "Recognizing identical inputs and reusable results avoids repeated work. A changing status cannot be replaced by an old result.",
  "play.extra.sample.video.hint":
    "Generated captions can be reused too, when the script is identical. Current export progress must always be queried again.",
  "play.extra.sample.video.cache": "Saved copies",
  "play.extra.sample.video.cacheNote": "Reuse an identical result prepared earlier.",
  "play.extra.sample.video.library": "Asset library",
  "play.extra.sample.video.libraryNote": "Fetch existing music and logo files.",
  "play.extra.sample.video.studio": "Production service",
  "play.extra.sample.video.studioNote":
    "Create captions, query progress, or process existing assets again.",
  "play.extra.sample.video.music": "Opening music",
  "play.extra.sample.video.musicDetail":
    "The library has music-v1. Later shots need the same file.",
  "play.extra.sample.video.musicRepeat": "The next shot needs the same music",
  "play.extra.sample.video.fileWhy":
    "This asset already exists in the library. The production service can process it too, at a higher cost.",
  "play.extra.sample.video.captions": "First-version captions",
  "play.extra.sample.video.captionDetail":
    "No captions have been created for script caption-v1 yet.",
  "play.extra.sample.video.captionRepeat": "The preview needs the same captions",
  "play.extra.sample.video.captionRepeatDetail":
    "The script is still caption-v1. Its content and version have not changed.",
  "play.extra.sample.video.captionWhy":
    "The library does not have new captions. Produce them first, then reuse the same version later.",
  "play.extra.sample.video.logo": "Closing logo",
  "play.extra.sample.video.logoDetail": "The library has logo-v3. Every shot uses the same file.",
  "play.extra.sample.video.logoRepeat": "Another shot needs the same logo",
  "play.extra.sample.video.progress": "Current export progress",
  "play.extra.sample.video.progressDetail": "Progress keeps changing. Query the current state.",
  "play.extra.sample.video.progressWhy":
    "Only the production service can query the current export state. An earlier progress value cannot be reused.",
  "play.extra.sample.video.source": "MDN · Caching and reuse",
  "play.contrast.search.title": "Matching the words, or matching the meaning",
  "play.contrast.search.brief":
    "Guess whether the two will agree this time, then see what each one did.",
  "play.contrast.search.goal":
    "Say when these two ways of searching give the same answer and when they do not.",
  "play.contrast.search.takeaway":
    "When the words match, either works; change the wording and only one still finds it; and landing in the same place does not mean it is the place you wanted.",
  "play.contrast.search.hint":
    "Ask first: do the words you typed appear in the text exactly as you typed them?",
  "play.contrast.search.source": "How search finds things",
  "play.contrast.search.question": "Give the same phrase to both. Will they agree?",
  "play.contrast.search.literal": "Match the words",
  "play.contrast.search.literalNote": "Take what you typed and look for it in the text as-is.",
  "play.contrast.search.similar": "Match the meaning",
  "play.contrast.search.similarNote":
    "Turn the meaning into numbers, then find the closest passage.",
  "play.contrast.search.exact": "Search “invoice”; the article says “invoice”",
  "play.contrast.search.exactDetail": "The word appears in the text exactly.",
  "play.contrast.search.exactBoth": "Finds that passage",
  "play.contrast.search.exactWhy":
    "The words line up and the meaning is closest too, so both roads lead to the same passage.",
  "play.contrast.search.synonym": "Search “receipt”; the article says “invoice”",
  "play.contrast.search.synonymDetail": "Close in meaning, not a single shared letter.",
  "play.contrast.search.synonymLiteral": "Finds nothing",
  "play.contrast.search.synonymSimilar": "Finds that passage",
  "play.contrast.search.synonymWhy":
    "Matching words only knows words. Matching meaning still gets there.",
  "play.contrast.search.typo": "Search “invoise” — you mistyped it",
  "play.contrast.search.typoDetail": "You still want the invoice passage.",
  "play.contrast.search.typoLiteral": "Finds nothing",
  "play.contrast.search.typoSimilar": "Finds that passage",
  "play.contrast.search.typoWhy":
    "One wrong letter and the words no longer line up; the meaning is still there, so the other road is unaffected.",
  "play.contrast.search.homograph": "Search “Apple” wanting the phone; the article is about fruit",
  "play.contrast.search.homographDetail": "Same word, two entirely different things.",
  "play.contrast.search.homographBoth": "Finds the passage about fruit",
  "play.contrast.search.homographWhy":
    "This time both land in the same place — and neither is what you wanted. The words match and the meaning really is close; close is not the same as right.",
  "play.contrast.search.orderId": "Search order number A7X99204",
  "play.contrast.search.orderIdDetail": "A string nobody can read a meaning into.",
  "play.contrast.search.orderIdLiteral": "Finds exactly that order",
  "play.contrast.search.orderIdSimilar":
    "Returns a pile of similar-looking numbers, maybe not this one",
  "play.contrast.search.orderIdWhy":
    "With no meaning to convert, matching the meaning does worse than matching the characters.",
  "play.weigh.reading.title": "Read the whole project, or only the part you are changing",
  "play.weigh.reading.brief":
    "Pick one for each situation. The same pick will not be right every time.",
  "play.weigh.reading.goal": "Say when each way of reading is worth what it costs.",
  "play.weigh.reading.takeaway":
    "When you know where to go, go there; when you do not, the time you saved comes back doubled.",
  "play.weigh.reading.hint": "Ask first: do you know which file you are changing?",
  "play.weigh.reading.source": "When a project is too big to read",
  "play.weigh.reading.question": "This time, how are you going to read this project?",
  "play.weigh.reading.piece": "Only the part I am changing",
  "play.weigh.reading.pieceNote": "Fast. But you cannot see what it is attached to.",
  "play.weigh.reading.whole": "Go through the whole project first",
  "play.weigh.reading.wholeNote": "Slow. But nothing you did not think of breaks afterwards.",
  "play.weigh.reading.ask": "Ask who owns this part",
  "play.weigh.reading.askNote": "Costs no reading time, but you wait for an answer.",
  "play.weigh.reading.button": "Change a button’s label from “Submit” to “Save”",
  "play.weigh.reading.buttonDetail": "You already know which file it is in.",
  "play.weigh.reading.buttonWhy":
    "You know where it is and the change touches nothing else; reading everything buys you nothing.",
  "play.weigh.reading.buttonCost":
    "A read-through costs an afternoon, and none of it gets used this time.",
  "play.weigh.reading.crash": "Big uploads crash and you do not know which part does it",
  "play.weigh.reading.crashDetail": "The error points at a file you have never seen.",
  "play.weigh.reading.crashWhy":
    "When you do not know where to change, “that part” cannot be found — you have to see what is attached to what.",
  "play.weigh.reading.crashCost":
    "Diving into the file in the error spends your time on code that is not the cause.",
  "play.weigh.reading.rename": "Rename something used in dozens of places",
  "play.weigh.reading.renameDetail": "You do not know which dozens.",
  "play.weigh.reading.renameWhy":
    "Changing one is not changing it. You have to know everywhere it appears, or you are building a half-changed project.",
  "play.weigh.reading.renameCost":
    "Change only the ones you saw and the rest break when somebody else hits them, long after anyone remembers this edit.",
  "play.weigh.reading.newPage": "Add a new page that touches nothing existing",
  "play.weigh.reading.newPageDetail": "It reads none of what is already there.",
  "play.weigh.reading.newPageWhy":
    "It is attached to nothing, so there is nothing unforeseen to break.",
  "play.weigh.reading.newPageCost":
    "Reading two thousand unrelated files to write one standalone thing.",
  "play.weigh.reading.firstDay":
    "First day on this project, asked to change a feature you have never heard of",
  "play.weigh.reading.firstDayDetail": "You are not even sure what it is called here.",
  "play.weigh.reading.firstDayWhy":
    "Reading the whole thing takes a week; reading “that part” needs you to know where that part is. Asking is the cheapest step here.",
  "play.weigh.reading.firstDayCost":
    "Reading it yourself, however much, spends a day rebuilding what is already in somebody’s head.",
  "play.weigh.reading.nobody": "Everyone who built this project has left; there is nobody to ask",
  "play.weigh.reading.nobodyDetail": "And the part you are changing is central.",
  "play.weigh.reading.nobodyWhy":
    "With nobody to ask, the project itself is the only documentation there is.",
  "play.weigh.reading.nobodyCost":
    "Insisting on saving that time with nobody to ask is changing something central with your eyes shut.",
  "play.difficulty.contrast.intro": "See it once: when they agree, and when they do not.",
  "play.difficulty.contrast.practice": "Judge all four, and say where the line is.",
  "play.difficulty.contrast.challenge":
    "Including the time both land in the same place and it is the wrong place.",
  "play.difficulty.weigh.intro": "Two situations, and the same two choices change sides.",
  "play.difficulty.weigh.practice": "Decide all four, and say what each one is short of.",
  "play.difficulty.weigh.challenge": "Add “ask somebody”, then find where that stops working too.",
  "play.mode.contrast": "Same or different",
  "play.mode.weigh": "Which one, here",
  "play.weigh.reading.buttonCostAsk":
    "Waiting on somebody to reply, to change a button you already know the location of.",
  "play.weigh.reading.crashCostAsk":
    "Somebody can tell you who owns this part; nobody can tell you which line crashes it.",
  "play.weigh.reading.renameCostAsk":
    "They list a few places from memory, and the ones they forget break anyway.",
  "play.weigh.reading.newPageCostAsk":
    "It is attached to nobody, so there is no \\u201cwho owns this\\u201d to ask about.",
  "play.weigh.reading.firstDayCostWhole":
    "Reading the whole project takes a week, and one question answers this.",
  "play.weigh.reading.nobodyCostAsk":
    "There is nobody to ask \\u2014 that is the premise of this situation.",
} as const;
