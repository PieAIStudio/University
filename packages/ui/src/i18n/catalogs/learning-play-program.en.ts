export const messages = {
  "play.program.boardTitle": "Plan the route, then send it off",
  "play.program.boardNote":
    "Forward follows the robot’s heading. Turning changes its heading, not its cell.",
  "play.program.programTitle": "Your instructions",
  "play.program.budget": "{{count}} / {{maximum}} commands",
  "play.program.budgetNote": "Use up to {{maximum}} commands, each repeated 1–{{repeat}} times.",
  "play.program.budgetFull":
    "All command slots are full. Increase a repeat count or remove a command.",
  "play.program.emptyTitle": "It’s waiting for your first instruction",
  "play.program.emptyBody":
    "Add “Forward”, then change its repeat count to the number of steps you need.",
  "play.program.forward": "Forward",
  "play.program.left": "Turn left",
  "play.program.right": "Turn right",
  "play.program.addCommand": "Add {{command}} command",
  "play.program.repeat": "Repeat",
  "play.program.repeatLabel": "Repeat count for command {{command}}",
  "play.program.times": "times",
  "play.program.moveUp": "Move command {{command}} up",
  "play.program.moveDown": "Move command {{command}} down",
  "play.program.remove": "Remove command {{command}}",
  "play.program.clear": "Clear",
  "play.program.run": "Run instructions",
  "play.program.runAgain": "Run again",
  "play.program.running": "Running",
  "play.program.starting": "Ready to set off. Watch which way it is facing.",
  "play.program.editCommand": "Edit command {{command}}",
  "play.program.backToEditor": "Back to instructions",
  "play.program.stop": "Stop and edit",
  "play.program.finishNow": "Show result now",
  "play.program.start": "Start",
  "play.program.goal": "Goal",
  "play.program.checkpoint": "Checkpoint",
  "play.program.wall": "Obstacle",
  "play.program.visited": "Visited",
  "play.program.north": "up",
  "play.program.east": "right",
  "play.program.south": "down",
  "play.program.west": "left",
  "play.program.pose": "At {{cell}}, facing {{direction}}",
  "play.program.startPose": "Start at {{cell}}, facing {{direction}}",
  "play.program.checkpointCount": "Checkpoints {{visited}} / {{total}}",
  "play.program.stepCount": "Step {{step}} / {{total}}",
  "play.program.ready": "When your route is ready, run the instructions.",
  "play.program.edited":
    "Instructions updated. The robot is back at the start, ready to try again.",
  "play.program.stopped": "Stopped and returned to the start. Your instructions are still here.",
  "play.program.currentCommand": "Command {{command}}, “{{operation}}”, repetition {{repeat}}",
  "play.program.mapDescription":
    "Grid: {{width}} columns and {{height}} rows, with A1 at the top left. Start {{start}}, facing {{direction}}; goal {{goal}}; checkpoints {{checkpoints}}; obstacles {{walls}}.",
  "play.program.none": "none",
  "play.program.traceTitle": "Step-by-step trace · {{count}} steps",
  "play.program.traceStep":
    "{{step}}. Command {{command}}, repeat {{repeat}}: {{operation}}, at {{cell}} facing {{direction}}",
  "play.program.traceBlocked":
    "{{step}}. Command {{command}}, repeat {{repeat}}: {{operation}} was blocked; still at {{cell}} facing {{direction}}",
  "play.program.traceCheckpoint": " · {{count}} checkpoints visited",
  "play.program.success":
    "Visited all {{checkpoints}} checkpoints and stopped at the goal. {{commands}} commands executed {{steps}} steps.",
  "play.program.empty": "Add an instruction before sending the robot off.",
  "play.program.invalidActivity":
    "This grid’s configuration is incomplete, so it cannot run yet. Try another scenario.",
  "play.program.invalidCommand":
    "Command {{command}} is invalid. Its repeat count must be a whole number from 1 to {{maximum}}.",
  "play.program.overBudget":
    "This program uses {{count}} commands, but the grid allows {{maximum}}. Try combining repeated actions.",
  "play.program.hitWall":
    "Command {{command}}, repetition {{repeat}}: {{cell}} is blocked. The robot stopped at {{position}}. Try turning earlier.",
  "play.program.outOfBounds":
    "Command {{command}}, repetition {{repeat}} would leave the grid. The robot stopped at {{position}}. Take fewer steps or turn first.",
  "play.program.missingCheckpoints":
    "Visited {{visited}} / {{total}} checkpoints. Still visit {{missing}}, then stop at {{goal}}.",
  "play.program.notAtGoal":
    "All checkpoints were visited, but the robot stopped at {{position}}. It still needs to reach the goal at {{goal}}.",
  "play.program.source": "MDN: Loops and iteration",
  "play.program.delivery.title": "Deliver around the block",
  "play.program.delivery.brief":
    "This little courier understands only three instructions. Guide it around the buildings, deliver both parcels, then return to the post office at the top right.",
  "play.program.delivery.goal":
    "Visit both checkpoints and stop at the goal, using no more than 5 commands.",
  "play.program.delivery.takeaway":
    "Writing “Forward, repeat twice” shortens the program, but the robot still takes both steps. A turn changes the direction of its next forward step.",
  "play.program.delivery.hint":
    "Start facing up. Go to A3, cross row 3 to the far right, then head up. Combine consecutive forward steps into one command.",
  "play.program.irrigation.title": "Water every bed before clocking off",
  "play.program.irrigation.brief":
    "The watering robot starts at the bottom left. Three garden beds need water, and its charger is at the top right. Don’t leave any bed dry on the way home.",
  "play.program.irrigation.goal":
    "Visit all three checkpoints and stop at the goal, using no more than 7 commands.",
  "play.program.irrigation.takeaway":
    "A program can have several conditions: water every bed, avoid obstacles, and return to the charger. Meeting just one condition does not complete the job.",
  "play.program.irrigation.hint":
    "Follow the bottom row to C5, head up to C2, then right to F2. Use one repeated forward command per straight stretch, and save a command for the final step to the charger.",
} as const;
