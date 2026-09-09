export const messages = {
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
} as const;
