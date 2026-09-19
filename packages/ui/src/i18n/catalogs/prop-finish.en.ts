export const messages = {
  "finish.diagnostic":
    "Inspect mesh masks (red: ambient visibility; green: convex edge, not the final finish)",
  "finish.triangles": "Triangles in this object",
  "finish.costGeometry": "Extra bevel geometry; select for close views",
  "finish.costMaterial": "Same triangle count; one local mask and added material work",
  "finish.costSame": "No added triangles",
  "finish.advice.sculpted.rock":
    "Watch the pebbles in the gray cluster: their silhouettes remain while shading joins more smoothly. This is the useful part retained from the previous study.",
  "finish.advice.sculpted.plant":
    "The canopy is already rounded, so further softening offers less. Compare it, but do not apply the method to every tree just for uniformity.",
  "finish.advice.sculpted.built":
    "This method can bend the shading of flat boards. Timber frames may not improve; compare physical edge rounding when structural planes must stay flat.",
  "finish.advice.bevel.rock":
    "Sharp edges become actual narrow round faces; pebbles feel less folded. Broad planes remain. Distant tiny rocks do not justify the added geometry.",
  "finish.advice.bevel.plant":
    "Rounded foliage may gain little from more bevels. We keep this comparison visible rather than pretending the method should be enabled everywhere.",
  "finish.advice.bevel.built":
    "Watch the fountain rim, doorway and cart edges: transitions come from real rounded strips rather than painted highlights over an entire panel.",
  "finish.advice.crafted.rock":
    "Watch the broad mineral faces: shallow relief and restrained convex-edge pigment replace plain color panels. Silhouette and triangle count stay intact.",
  "finish.advice.crafted.plant":
    "Trunk grain follows the wooden part. Foliage receives neither bright triangle outlines nor rock texture; the canopy treatment stays restrained.",
  "finish.advice.crafted.built":
    "Grain follows each wooden shell; coatings and joints are treated separately. It is not uniform noise or a permanent sun shadow painted onto the object.",

  "finish.eyebrow": "MAP OBJECTS · SURFACE REFINEMENT STUDY",
  "finish.title": "One object, four treatments",
  "finish.intro":
    "Ten objects actually used on the islands. Compare the same sources under the same lighting, without swapping in better demonstration models.",
  "finish.games": "Back to the nine 3D games",
  "finish.methods": "Choose a treatment",
  "finish.method.original": "Original",
  "finish.method.sculpted": "Soft-sculpted surface",
  "finish.method.bevel": "Physical edge rounding",
  "finish.method.crafted": "Material-aware finish",
  "finish.about.original":
    "Both sides use the map's original model and material. Lights, scale and pedestal are identical: this is the comparison baseline.",
  "finish.about.sculpted":
    "Soften shading between adjacent faces and tame sharp reflections. Silhouettes and triangle counts stay intact. Useful for rounded props such as rocks; not a wax effect.",
  "finish.about.bevel":
    "Add actual narrow rounded edges that catch light while large panels remain flat. Silhouettes change slightly and triangle counts increase; the object is not smoothed into a ball.",
  "finish.about.crafted":
    "Keep the original palette, adding grain along each wooden piece, fine mineral relief and softer coating reflections. Edge and joint masks come from actual geometry, not random dirt or whole-object darkening.",
  "finish.pair": "Side-by-side detail",
  "finish.gallery": "All ten objects",
  "finish.reset": "Reset view",
  "finish.zoom": "Zoom",
  "finish.stage": "Object comparison. Drag to rotate both, or use left and right arrow keys.",
  "finish.failed":
    "The comparison could not open. Originals are unchanged; try reloading the scene.",
  "finish.retry": "Reopen 3D",
  "finish.loading": "Preparing ten original objects and their derived copies…",
  "finish.hint":
    "Drag to rotate both sides together; arrow keys work too. Select an object below. Every treatment uses the same lights.",
  "finish.objects": "Ten real map objects",
  "finish.object.rock-large": "Moss-topped rock",
  "finish.object.rock-small": "Gray rock cluster",
  "finish.object.fir": "Fir tree",
  "finish.object.broadleaf": "Broadleaf tree",
  "finish.object.stall": "Market stall",
  "finish.object.cart": "Wooden cart",
  "finish.object.lantern": "Lantern",
  "finish.object.fountain": "Round fountain",
  "finish.object.doorway": "Square doorway",
  "finish.object.roof": "Gable roof",
  "finish.boundary":
    "Treatments are independent, not secretly stacked. Original assets, the procedural map and all nine games remain unchanged. This selection does not change the rest of the world.",
  "finish.technical": "Sources, cost and suitable uses",
  "finish.technicalNote":
    "Originals use the map's existing asset loading, color and tree generation code. Sculpting changes derived normals and materials. Bevels are generated offline. Material finishing uses authored color roles, each wooden shell's direction, actual convex edges and indirect-light visibility; it does not stack the other two treatments. Transparent water stays original.",
  "finish.grade": "Use the shared final color grade",
  "finish.cost":
    "These are not three filters that must always be combined. Bevels suit hard-edged props; material finishing suits minerals, timber and coatings. Foliage does not receive bright triangle outlines; a convex surface gains little from occlusion alone. Choose per object and viewing distance when integrating.",
  "finish.retired":
    "The wax-island study has been retired: it did not achieve the intended wax identity. Useful object-refinement methods now have a separate comparison page.",
  "finish.open": "Open the ten-object comparison",
} as const;
