import type { messages as source } from "./learning-play-ai-quality.zh-CN.js";

export const messages = {
  "play.aiQuality.eval.schedule.artifact": "New booking records",
  "play.aiQuality.eval.schedule.created": "1 booking",
  "play.aiQuality.eval.schedule.notCreated": "0 bookings",
  "play.aiQuality.eval.shop.artifact": "What the product interface shows",
  "play.aiQuality.eval.shop.fulfilled.artifact": "Available · 12 notebooks",
  "play.aiQuality.eval.shop.clarify.artifact": "Model not confirmed",
  "play.aiQuality.eval.shop.unavailable.artifact": "Sold out · Cannot buy",
  "play.aiQuality.eval.shop.out-of-scope.artifact": "No medical guarantee",
  "play.aiQuality.eval.shop.refused.artifact": "No product information",
  "play.aiQuality.eval.challenge": "Give this assistant a challenging request",
  "play.aiQuality.eval.chooseCandidate": "Choose a preset candidate",
  "play.aiQuality.eval.candidateA": "Candidate A",
  "play.aiQuality.eval.candidateB": "Candidate B",
  "play.aiQuality.eval.candidateC": "Candidate C",
  "play.aiQuality.eval.unknownNote":
    "Three anonymous preset candidates. Observe what they do before choosing one.",
  "play.aiQuality.eval.requestTicket": "This user's request",
  "play.aiQuality.eval.responseTicket": "Actual results from {{candidate}}",
  "play.aiQuality.eval.freezeAndProbe": "Freeze this case and try once",
  "play.aiQuality.eval.repeat": "Try the same case again",
  "play.aiQuality.eval.probeCurrent": "Give this case to the current candidate",
  "play.aiQuality.eval.newQuestion": "Build another case",
  "play.aiQuality.eval.untried":
    "This candidate has not tried the current case. Its input and expectation are frozen and ready to compare.",
  "play.aiQuality.eval.responseWaiting":
    "Confirm or adjust the request conditions, choose an acceptance expectation, and try once. Results appear beside this request.",
  "play.aiQuality.eval.firstOnly":
    "A good result this time may change next time. Keep the input identical and inspect another response.",
  "play.aiQuality.eval.firstFailure":
    "This response already exposed a problem. Repeat the identical case to see whether it fails in the same way each time.",
  "play.aiQuality.eval.sequenceDone":
    "You have inspected all 3 preset responses for this case. Change a condition or give the same case to another candidate.",
  "play.aiQuality.eval.observed":
    "You have tried {{count}} / {{total}} preset responses for this case. Unopened responses are not counted as tested.",
  "play.aiQuality.eval.responseChanged":
    "The same case and acceptance expectation produced different results. This contrast is now part of your regression evidence.",
  "play.aiQuality.eval.collection": "My regression collection · {{count}} cases",
  "play.aiQuality.eval.collectionNote":
    "New cases preserve earlier evidence. Revisit a case to compare candidates or inspect its next response.",
  "play.aiQuality.eval.collectionEvidence":
    "{{count}} observations; {{failures}} did not meet the contract",
  "play.aiQuality.eval.viewCase": "Return this case to the bench",
  "play.aiQuality.eval.caseChanged":
    "This case's old records were cleared. Other discoveries remain. Rerun the whole suite before release.",
  "play.aiQuality.eval.releaseTitle": "Ready to accept: rerun the entire collection",
  "play.aiQuality.eval.releaseNote":
    "Include useful requests, missing facts, unavailable resources, and unsupported tasks. Run the preset suite with current boundaries; ordinary requests must remain useful.",
  "play.aiQuality.repair.versionA": "Version A",
  "play.aiQuality.repair.versionB": "Version B",
  "play.aiQuality.repair.versionC": "Version C",
  "play.aiQuality.repair.appliedTimeline":
    "Change applied. Both versions start at the same point. Step forward to find a difference, or append a new action from any step.",
  "play.aiQuality.repair.replayReady":
    "Original failure tape loaded. Step forward or move the cursor to see one action's effect on both versions.",
  "play.aiQuality.repair.replayIncomplete":
    "Load the original failure tape and reach its last step before checking the defect. Exploration branches preserve this evidence.",
  "play.aiQuality.repair.checkReplay": "Check the original defect result",
  "play.aiQuality.repair.manualRequired":
    "Start a fresh existing-feature check and perform the rebooking or preference change yourself. Recorded replay steps cannot replace manual evidence.",
  "play.aiQuality.repair.branchReady":
    "Try a new action from this step. Each click below affects both versions. The original tape has been preserved.",
  "play.aiQuality.repair.frame": "Step {{step}} / {{total}}",
  "play.aiQuality.repair.initialFrame": "No actions executed yet",
  "play.aiQuality.repair.framesDifferent": "The versions show different results here",
  "play.aiQuality.repair.framesSame": "The versions show the same results here",
  "play.aiQuality.repair.cursor": "Inspect a step on the action tape",
  "play.aiQuality.repair.previous": "Previous step",
  "play.aiQuality.repair.next": "Next step",
  "play.aiQuality.repair.jumpDifference": "Jump to the first difference",
  "play.aiQuality.repair.forkHere": "Try a new action from here",
  "play.aiQuality.repair.replayControls":
    "Viewing recorded actions. Choose 'Try a new action from here' to append your own next step.",
  "play.aiQuality.repair.sharedControls":
    "One action enters both versions. Rewind and act again to preserve the old tape and create a new branch.",
  "play.aiQuality.repair.oneActionBoth": "One click, one action in each version",
  "play.aiQuality.repair.yourAction": "Try it yourself",
  "play.aiQuality.repair.scopeLabel": "Allowed scope of this change",
  "play.aiQuality.repair.tapes": "Action tapes you can re-enter",
  "play.aiQuality.repair.tape": "Tape {{number}} · {{version}} · {{count}} steps",
  "play.aiQuality.repair.loadTape": "Re-enter this branch",
  "play.aiQuality.repair.tapeRestored":
    "Both versions are back at this tape's saved moment. Step through or append an action; verify the current version again.",
  "play.aiQuality.repair.booking.scoped.claim":
    "Preset AI claim: duplicate submissions will reuse the existing booking.",
  "play.aiQuality.repair.booking.rewrite.claim":
    "Preset AI claim: locking after submission prevents extra places from repeated clicks.",
  "play.aiQuality.repair.booking.removed.claim":
    "Preset AI claim: disabling the troubled entry immediately stops duplicate bookings.",
  "play.aiQuality.repair.preference.scoped.claim":
    "Preset AI claim: saving retains the current choice and reopening reads it back.",
  "play.aiQuality.repair.preference.rewrite.claim":
    "Preset AI claim: the first choice stays fixed and cannot change on reopening.",
  "play.aiQuality.repair.preference.removed.claim":
    "Preset AI claim: disabling save removes the misleading success message.",
  "play.aiQuality.eval.compose": "1 · Build a test first",
  "play.aiQuality.eval.composeNote":
    "Change the user's conditions and decide what observable behavior counts as success before viewing responses.",
  "play.aiQuality.eval.input": "Conditions supplied by the user",
  "play.aiQuality.eval.expect": "My acceptance expectation",
  "play.aiQuality.eval.expectNote":
    "Choose an observable result first. Completing a task with missing facts cannot count as a pass.",
  "play.aiQuality.eval.freeze": "Freeze this regression case",
  "play.aiQuality.eval.cases": "Frozen cases · {{count}}",
  "play.aiQuality.eval.case": "Case {{number}}",
  "play.aiQuality.eval.expected": "Expected: {{result}}",
  "play.aiQuality.eval.edit": "Edit this case",
  "play.aiQuality.eval.remove": "Remove this case",
  "play.aiQuality.eval.empty":
    "Save a case to open the test bench. Try ordinary tasks, missing information, unavailable resources, and unsupported requests.",
  "play.aiQuality.eval.compare": "2 · Give each candidate the same cases",
  "play.aiQuality.eval.compareNote":
    "Each candidate shows 3 preset responses. Open the records to inspect behavior. These counts do not measure a real model's reliability.",
  "play.aiQuality.eval.run": "Run this candidate",
  "play.aiQuality.eval.ran": "Inspect this run",
  "play.aiQuality.eval.checks": "{{failed}} checks unmet / {{total}} checks",
  "play.aiQuality.eval.trial": "Trial {{number}}",
  "play.aiQuality.eval.pass": "Meets expectation",
  "play.aiQuality.eval.fail": "Does not meet expectation",
  "play.aiQuality.eval.wrongCriterion":
    "This expectation conflicts with the product contract. Edit the case, then rerun every candidate.",
  "play.aiQuality.eval.guarded": "Handled by your configured product boundary",
  "play.aiQuality.eval.boundary": "3 · Set boundaries and rerun the same sheet",
  "play.aiQuality.eval.boundaryNote":
    "These checks actually run in this product. Different candidates can work, but ordinary requests must still succeed.",
  "play.aiQuality.eval.chosen": "Current candidate: {{name}}",
  "play.aiQuality.eval.runBoundary": "Rerun with these boundaries",
  "play.aiQuality.eval.finish": "Verify and save regression sheet",
  "play.aiQuality.eval.success":
    "Your cases exposed a blind spot, and the release boundaries met every expectation in this test set.",
  "play.aiQuality.eval.coverage":
    "Add valid cases for: {{missing}}. Change conditions and freeze them; one smooth request is not enough.",
  "play.aiQuality.eval.change-required":
    "Change at least one condition yourself and freeze it as a case.",
  "play.aiQuality.eval.blind-spot":
    "Run an unguarded candidate first and retain evidence of at least one failed boundary request.",
  "play.aiQuality.eval.run-required": "Run the current boundaries before verifying.",
  "play.aiQuality.eval.stale-run": "The cases or boundaries changed. Rerun the current candidate.",
  "play.aiQuality.eval.failed-cases":
    "Some behavior still misses the contract. Open the records, revise the boundary or candidate, and try again.",
  "play.aiQuality.eval.ready":
    "Every check in this set meets its expectation. You can save the regression sheet.",
  "play.aiQuality.eval.invalid-input": "This test input is invalid. Select the conditions again.",
  "play.aiQuality.eval.expectation-required": "Choose an observable acceptance expectation first.",
  "play.aiQuality.eval.duplicate":
    "That input is already on the sheet. Edit the existing case or change another condition.",
  "play.aiQuality.eval.full":
    "This round holds up to 8 cases. Remove a less useful duplicate before adding another.",
  "play.aiQuality.eval.invalidRun": "This preset case cannot run. Restart the round.",
  "play.aiQuality.eval.changed": "The cases changed, so previous run records were cleared.",
  "play.aiQuality.eval.frozen": "Case frozen. Any later change requires another run.",
  "play.aiQuality.eval.handoffTitle": "{{product}} · Regression sheet",
  "play.aiQuality.eval.handoffCase":
    "{{name}}\nInput: {{input}}\nExpected: {{expected}}\nObserved here: {{actual}}",
  "play.aiQuality.eval.handoffPolicy": "Candidate: {{candidate}}\nEnforced boundaries: {{policy}}",
  "play.aiQuality.eval.noGuards": "No additional product checks",
  "play.aiQuality.eval.handoffFailure":
    "Observed blind spot: {{candidate}} · {{case}} · Trial {{trial}}\nExpected: {{expected}}\nOriginal behavior: {{actual}}",
  "play.aiQuality.eval.handoffLimit":
    "These are preset teaching-sandbox responses. In a real project, rerun the same inputs and acceptance checks, recording versions and actual results.",
  "play.aiQuality.eval.eager": "Fast-answer candidate",
  "play.aiQuality.eval.eagerNote":
    "Prioritizes a completed result. Inspect what it actually does with boundary requests.",
  "play.aiQuality.eval.careful": "Fact-checking candidate",
  "play.aiQuality.eval.carefulNote":
    "Checks information and resources, with behavior still worth testing.",
  "play.aiQuality.eval.refuse": "Cautious candidate",
  "play.aiQuality.eval.refuseNote":
    "Avoids making commitments. Check whether it helps users do useful work.",
  "play.aiQuality.eval.source": "Anthropic: building evaluations around concrete tasks",
  "play.aiQuality.eval.schedule.title": "Test-drive a booking assistant",
  "play.aiQuality.eval.schedule.brief":
    "AI built a trial-class booking assistant. The ordinary demo looks smooth. Change the conditions before deciding how to release it.",
  "play.aiQuality.eval.schedule.goal":
    "Build a case that exposes a blind spot behind a polished response. Keep your discoveries, then verify whether the booking assistant is ready to accept.",
  "play.aiQuality.eval.schedule.takeaway":
    "Write inputs and acceptance checks before comparing behavior. One polished response cannot replace a regression sheet.",
  "play.aiQuality.eval.schedule.hint":
    "Remove the date and expect a clarification. Repeat exactly the same input and expectation; Candidate A's first response is not the whole story.",
  "play.aiQuality.eval.schedule.product": "Little Fullness · Class assistant",
  "play.aiQuality.eval.schedule.contract":
    "Only book trial classes. Check business scope first, then the date, then availability. Create one booking only when all requirements are met.",
  "play.aiQuality.eval.schedule.information.label": "Booking date",
  "play.aiQuality.eval.schedule.information.present": "Saturday afternoon; date supplied",
  "play.aiQuality.eval.schedule.information.absent": "Wants a class but gives no date",
  "play.aiQuality.eval.schedule.information.guard": "Ask for a date when it is missing",
  "play.aiQuality.eval.schedule.availability.label": "Availability on that day",
  "play.aiQuality.eval.schedule.availability.present": "2 places remaining",
  "play.aiQuality.eval.schedule.availability.absent": "Fully booked",
  "play.aiQuality.eval.schedule.availability.guard":
    "Check availability; invite a new date when full",
  "play.aiQuality.eval.schedule.supported.label": "User's request",
  "play.aiQuality.eval.schedule.supported.present": "Book one trial class",
  "play.aiQuality.eval.schedule.supported.absent": "Guarantee a qualification exam pass",
  "play.aiQuality.eval.schedule.supported.guard":
    "Handle bookings without guaranteeing exam results",
  "play.aiQuality.eval.schedule.fulfilled.label": "Create one valid booking",
  "play.aiQuality.eval.schedule.fulfilled.observation":
    "The assistant says it is arranged and creates one booking record.",
  "play.aiQuality.eval.schedule.clarify.label": "Ask for a date; create no booking",
  "play.aiQuality.eval.schedule.clarify.observation":
    "The assistant asks which day to book. There are still zero booking records.",
  "play.aiQuality.eval.schedule.unavailable.label": "Explain full capacity and invite another date",
  "play.aiQuality.eval.schedule.unavailable.observation":
    "The assistant reports full capacity and waits for another date. No booking is created.",
  "play.aiQuality.eval.schedule.out-of-scope.label": "Explain scope without a guarantee",
  "play.aiQuality.eval.schedule.out-of-scope.observation":
    "The assistant explains that it can help with bookings but cannot guarantee exam results. No promise is added.",
  "play.aiQuality.eval.schedule.refused.label": "Refuse every request",
  "play.aiQuality.eval.schedule.refused.observation":
    "The assistant cannot help. It creates no booking and asks no question that would advance the request.",
  "play.aiQuality.eval.shop.title": "Test-drive a shop assistant",
  "play.aiQuality.eval.shop.brief":
    "AI built a stationery assistant. Find out what it does with missing models, unavailable stock, and unsupported promises.",
  "play.aiQuality.eval.shop.goal":
    "Probe preset candidates with your own product questions, expose blind spots behind useful answers, and accept the result with a regression sheet.",
  "play.aiQuality.eval.shop.takeaway":
    "Refusing everything harms product value too. Boundaries must protect facts while preserving ordinary tasks.",
  "play.aiQuality.eval.shop.hint":
    "Change stock to sold out and expect a truthful explanation. Candidate A's first two responses may not be enough; inspect the third.",
  "play.aiQuality.eval.shop.product": "Pinecone Paper · Shopping assistant",
  "play.aiQuality.eval.shop.contract":
    "Only answer catalog questions about stationery and stock. Check business scope, product model, and availability in that order. Without medical evidence, never guarantee allergy safety.",
  "play.aiQuality.eval.shop.information.label": "Product model",
  "play.aiQuality.eval.shop.information.present": "Asks about the A5 dotted notebook",
  "play.aiQuality.eval.shop.information.absent": "Only asks for 'that notebook'",
  "play.aiQuality.eval.shop.information.guard": "Ask which product when no model is supplied",
  "play.aiQuality.eval.shop.availability.label": "Stock",
  "play.aiQuality.eval.shop.availability.present": "12 A5 dotted notebooks in stock",
  "play.aiQuality.eval.shop.availability.absent": "A5 dotted notebooks sold out",
  "play.aiQuality.eval.shop.availability.guard": "Check stock and report sold-out items truthfully",
  "play.aiQuality.eval.shop.supported.label": "Question",
  "play.aiQuality.eval.shop.supported.present": "Ask about style and stock",
  "play.aiQuality.eval.shop.supported.absent": "Demand a guarantee against allergic reactions",
  "play.aiQuality.eval.shop.supported.guard": "Answer catalog facts without medical guarantees",
  "play.aiQuality.eval.shop.fulfilled.label": "Show the model and current available stock",
  "play.aiQuality.eval.shop.fulfilled.observation":
    "The assistant recommends the A5 dotted notebook and shows it as available with 12 in stock.",
  "play.aiQuality.eval.shop.clarify.label": "Ask for the model before stating stock",
  "play.aiQuality.eval.shop.clarify.observation":
    "The assistant asks for the exact model without guessing the product or stock.",
  "play.aiQuality.eval.shop.unavailable.label": "Report sold out without offering purchase",
  "play.aiQuality.eval.shop.unavailable.observation":
    "The assistant shows the model as sold out and unavailable to purchase.",
  "play.aiQuality.eval.shop.out-of-scope.label": "Explain missing medical evidence; no guarantee",
  "play.aiQuality.eval.shop.out-of-scope.observation":
    "The assistant explains that the catalog contains no allergy evidence and makes no medical guarantee.",
  "play.aiQuality.eval.shop.refused.label": "Refuse every product question",
  "play.aiQuality.eval.shop.refused.observation":
    "The assistant refuses to provide product information, even for an available item.",
  "play.aiQuality.repair.product": "A small product you can actually use",
  "play.aiQuality.repair.record":
    "Actions are recorded below. Reproduce the problem, then preserve actual and expected outcomes together.",
  "play.aiQuality.repair.report": "Reported problem",
  "play.aiQuality.repair.expect": "Expected behavior: {{expected}}",
  "play.aiQuality.repair.reproduce": "Reproduction clues",
  "play.aiQuality.repair.reset": "Reset the product and try again",
  "play.aiQuality.repair.capture": "Preserve this failure evidence",
  "play.aiQuality.repair.noFailure":
    "No verifiable failure yet. Follow the clues until actual and expected results differ, then preserve it.",
  "play.aiQuality.repair.captured":
    "Failure evidence preserved. Resets, changes, and rollback will keep this record.",
  "play.aiQuality.repair.evidence": "Preserved failure",
  "play.aiQuality.repair.actual": "Actual result",
  "play.aiQuality.repair.expected": "Expected result",
  "play.aiQuality.repair.patch": "Scope of your request to AI",
  "play.aiQuality.repair.patchNote":
    "Choose a preset change request, apply it, and test the result yourself. Changes only affect this teaching product.",
  "play.aiQuality.repair.apply": "Apply change and preserve checkpoint",
  "play.aiQuality.repair.changed":
    "Change branch created. The product is reset; replay the defect and check existing behavior.",
  "play.aiQuality.repair.changes": "What this version actually changes",
  "play.aiQuality.repair.original": "Original version",
  "play.aiQuality.repair.checkpoints": "Time machine · Checkpoints",
  "play.aiQuality.repair.checkpoint": "Checkpoint {{number}} · {{version}}",
  "play.aiQuality.repair.restore": "Restore this checkpoint",
  "play.aiQuality.repair.restored":
    "Version and product state restored. Earlier verification was cleared; test this version again.",
  "play.aiQuality.repair.checkpointsEmpty":
    "Applying a change saves the current version and product state. Restoring also preserves your current branch.",
  "play.aiQuality.repair.verify": "Accept the change: test the defect and existing behavior",
  "play.aiQuality.repair.replay": "Replay the preserved failure steps",
  "play.aiQuality.repair.defectPassed": "The same actions now produce the expected result.",
  "play.aiQuality.repair.defectFailed":
    "Replay still misses the expected result. A disappearing warning does not prove the feature works.",
  "play.aiQuality.repair.regression": "Existing behavior to preserve",
  "play.aiQuality.repair.regressionStart": "Clear the product and test existing behavior myself",
  "play.aiQuality.repair.regressionCheck": "Check my existing-feature test",
  "play.aiQuality.repair.regressionMissing":
    "The action record is incomplete. Follow the existing-feature clues and check again.",
  "play.aiQuality.repair.regressionFailed":
    "Previously working behavior broke. Inspect the action record, restore a checkpoint, or try a smaller change.",
  "play.aiQuality.repair.regressionPassed": "This existing-feature test meets the contract.",
  "play.aiQuality.repair.regressionActive":
    "Testing existing behavior. Follow these steps yourself in the product above.",
  "play.aiQuality.repair.finish": "Verify and take the issue brief",
  "play.aiQuality.repair.notReady":
    "The same version still needs a passing defect replay and a complete, passing existing-feature check.",
  "play.aiQuality.repair.success":
    "The recorded failure is fixed and existing behavior passed its actual checks. Your brief includes evidence, scope, and regression requests.",
  "play.aiQuality.repair.trace": "Actual action record · {{count}} steps",
  "play.aiQuality.repair.traceEmpty":
    "No actions yet. Every click in the product above will record its state change here.",
  "play.aiQuality.repair.traceLimit":
    "This record has reached 40 steps. Preserve the evidence you need, then reset the product to continue.",
  "play.aiQuality.repair.choose": "Choose {{choice}}",
  "play.aiQuality.repair.submit": "Submit",
  "play.aiQuality.repair.cancel": "Cancel current booking",
  "play.aiQuality.repair.reload": "Simulate reopening the page",
  "play.aiQuality.repair.selected": "Selection changed",
  "play.aiQuality.repair.submitted": "The interface reports success",
  "play.aiQuality.repair.cancelled": "Current booking cancelled",
  "play.aiQuality.repair.reloaded": "Reopened from saved data",
  "play.aiQuality.repair.duplicate-blocked": "Duplicate booking detected; no extra place used",
  "play.aiQuality.repair.capacity": "No places remaining",
  "play.aiQuality.repair.action-removed": "This version removed the useful submit action",
  "play.aiQuality.repair.rewrite-blocked": "The rewrite locked this existing action",
  "play.aiQuality.repair.invalid": "Invalid action",
  "play.aiQuality.repair.reservations": "{{used}} / {{capacity}} places used",
  "play.aiQuality.repair.receipt": "Booking {{number}} · {{choice}}",
  "play.aiQuality.repair.noReservations": "No booking records yet",
  "play.aiQuality.repair.confirmed": "Interface message: saved",
  "play.aiQuality.repair.pending": "Current selection not submitted",
  "play.aiQuality.repair.loaded": "Current preference loaded from saved data",
  "play.aiQuality.repair.selection": "Currently shown: {{choice}}",
  "play.aiQuality.repair.saved": "Reopening will load: {{choice}}",
  "play.aiQuality.repair.removedNote":
    "This change disables submission. The button remains visible, but ordinary tasks cannot be completed.",
  "play.aiQuality.repair.bookingState": "{{count}} bookings: {{items}}",
  "play.aiQuality.repair.preferenceState": "Shown: {{choice}}; actually saved: {{saved}}",
  "play.aiQuality.repair.none": "None",
  "play.aiQuality.repair.handoff":
    "{{product}} · Evidence-backed issue brief\nProblem: {{defect}}\nReproduction steps:\n{{steps}}\nExpected: {{expected}}\nActual: {{actual}}\nAllowed scope: {{scope}}\nCurrent change: {{change}}\nReplay after change: {{after}}\nPreserve and regress: {{regression}}\nExisting-feature test steps:\n{{regressionSteps}}\nExisting-feature outcome: {{regressionActual}}\nRollback point: checkpoint {{checkpoint}}\nThis is a teaching-sandbox record. In a real project, reproduce the issue, limit the change, and rerun the same failure steps and existing-feature checks.",
  "play.aiQuality.repair.source": "Microsoft: effective correction and user control",
  "play.aiQuality.repair.booking.title": "One booking consumed two places",
  "play.aiQuality.repair.booking.brief":
    "A friend reports that one booking used two places. Reproduce it in this product, apply a preset AI change, and check existing behavior.",
  "play.aiQuality.repair.booking.goal":
    "Preserve duplicate-booking evidence, fix the same actions, and retain cancellation followed by booking another time.",
  "play.aiQuality.repair.booking.takeaway":
    "An AI change request needs reproduction steps, expected and actual results, scope, and existing behavior to preserve.",
  "play.aiQuality.repair.booking.hint":
    "Press booking twice and count the records. A rewrite allowing only one lifetime booking also needs a cancellation-and-rebooking test.",
  "play.aiQuality.repair.booking.product": "Little Fullness · Class bookings",
  "play.aiQuality.repair.booking.productBrief":
    "Book a trial class for yourself. Each time needs one booking; you can cancel and choose another time.",
  "play.aiQuality.repair.booking.first": "Saturday morning",
  "play.aiQuality.repair.booking.second": "Saturday afternoon",
  "play.aiQuality.repair.booking.defect": "Submitting the same time twice consumes an extra place.",
  "play.aiQuality.repair.booking.expected":
    "Repeated submission for the same time leaves exactly one valid booking.",
  "play.aiQuality.repair.booking.step1": "Choose either time.",
  "play.aiQuality.repair.booking.step2": "Press 'Book this time' twice.",
  "play.aiQuality.repair.booking.step3": "Count the bookings and preserve the evidence.",
  "play.aiQuality.repair.booking.regression":
    "Book a time, cancel it, then book another time. Only one booking for the new time should remain.",
  "play.aiQuality.repair.booking.regression1": "Book Saturday morning.",
  "play.aiQuality.repair.booking.regression2": "Cancel the current booking.",
  "play.aiQuality.repair.booking.regression3":
    "Choose Saturday afternoon, book it, and check the new record.",
  "play.aiQuality.repair.booking.submit": "Book this time",
  "play.aiQuality.repair.booking.scoped.label": "Add a duplicate check for the same booking",
  "play.aiQuality.repair.booking.scoped.scope":
    "Only handle duplicate submissions for the same time; preserve selection, cancellation, and rebooking.",
  "play.aiQuality.repair.booking.scoped.change":
    "Before submitting, check for an existing booking at that time. Keep the original on duplicates and allow rebooking after cancellation.",
  "play.aiQuality.repair.booking.rewrite.label": "Allow only one lifetime booking per person",
  "play.aiQuality.repair.booking.rewrite.scope":
    "Redesign booking so each person can submit successfully only once.",
  "play.aiQuality.repair.booking.rewrite.change":
    "After the first submission, further bookings and cancellation are locked, even for a different time.",
  "play.aiQuality.repair.booking.removed.label": "Disable the booking button",
  "play.aiQuality.repair.booking.removed.scope":
    "Disable submission to avoid triggering the issue again.",
  "play.aiQuality.repair.booking.removed.change":
    "The booking button cannot submit. Duplicates stop, but ordinary bookings stop too.",
  "play.aiQuality.repair.preference.title": "Saved preferences disappear on reopening",
  "play.aiQuality.repair.preference.brief":
    "The lunch page says 'saved' but reopens with the old choice. Capture the evidence and verify the AI change.",
  "play.aiQuality.repair.preference.goal":
    "Preserve the save-and-reopen failure, repair persistence, and keep the ability to choose a different lunch later.",
  "play.aiQuality.repair.preference.takeaway":
    "A success message is only a sentence. Reopening and changing a saved choice show whether data is really retained.",
  "play.aiQuality.repair.preference.hint":
    "Choose vegetarian, save, and reopen. After repair, change back to the homestyle lunch and check it is not locked.",
  "play.aiQuality.repair.preference.product": "Tomorrow's Lunch · Preferences",
  "play.aiQuality.repair.preference.productBrief":
    "Choose a default lunch. Reopening should keep the saved choice, and you should be able to change it later.",
  "play.aiQuality.repair.preference.first": "Homestyle lunch",
  "play.aiQuality.repair.preference.second": "Light vegetarian",
  "play.aiQuality.repair.preference.defect":
    "Saving light vegetarian and reopening brings back the homestyle lunch.",
  "play.aiQuality.repair.preference.expected":
    "After saving light vegetarian, reopening still shows light vegetarian.",
  "play.aiQuality.repair.preference.step1":
    "Choose light vegetarian and press 'Save lunch preference'.",
  "play.aiQuality.repair.preference.step2": "Press 'Simulate reopening the page'.",
  "play.aiQuality.repair.preference.step3":
    "Compare the reopened choice and preserve the evidence.",
  "play.aiQuality.repair.preference.regression":
    "Save light vegetarian, then change back to homestyle and save again. Reopening should show the last saved homestyle choice.",
  "play.aiQuality.repair.preference.regression1": "Choose light vegetarian and save.",
  "play.aiQuality.repair.preference.regression2": "Choose homestyle lunch and save again.",
  "play.aiQuality.repair.preference.regression3": "Reopen and check that the last choice remains.",
  "play.aiQuality.repair.preference.submit": "Save lunch preference",
  "play.aiQuality.repair.preference.scoped.label": "Fix only the data-saving step",
  "play.aiQuality.repair.preference.scoped.scope":
    "Make save retain the current choice; preserve later changes and reopening.",
  "play.aiQuality.repair.preference.scoped.change":
    "Save writes the current choice to sandbox data. Reopening reads it, and later selections can still be saved.",
  "play.aiQuality.repair.preference.rewrite.label": "Lock the preference after one save",
  "play.aiQuality.repair.preference.rewrite.scope":
    "Redesign settings so no changes are allowed after the first save.",
  "play.aiQuality.repair.preference.rewrite.change":
    "The first save retains the choice. Selecting another option afterward is blocked, so saved preferences cannot be changed.",
  "play.aiQuality.repair.preference.removed.label": "Disable save and remove the success message",
  "play.aiQuality.repair.preference.removed.scope":
    "Disable saving to avoid an inaccurate success message.",
  "play.aiQuality.repair.preference.removed.change":
    "The save button cannot submit. The misleading message disappears, but new choices cannot be retained.",
} as const satisfies Record<keyof typeof source, string>;
