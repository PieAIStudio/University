// A prototype of a SwimmerUIKit change, used only by the design pages.
//
// The kit adds its gloss to the body with an arithmetic composite (k2 = k3 = 1)
// after clipping the light to the body. On the body's anti-aliased edge a
// half-covered pixel then gets the body's alpha plus the light's alpha, and
// comes out fully opaque wherever the highlight is bright: the edge loses its
// anti-aliasing and steps. That is the stair-stepped top edge the Owner saw
// (2026-09-30), and why the bottom edge, which the light never reaches, stays
// smooth.
//
// softenGloss() keeps the kit's highlight exactly as it is lit and only
// changes where it may land: a mask one pixel inside the edge, feathered, so the
// light never touches an edge pixel. In the kit this would be one change to the
// gloss chain's clip; until the Owner approves that release, the pages patch
// the rendered filter.
export const SOFT_GLOSS = { inset: 1.2, feather: 0.8 };

const NS = "http://www.w3.org/2000/svg";

/** Soften every gloss under `root`, or (on = false) put the kit's own back. */
export function softenGloss(root, on = true, { inset, feather } = SOFT_GLOSS) {
  if (!root) return;
  for (const light of root.querySelectorAll("feSpecularLighting")) {
    const filter = light.parentNode;
    const clip = filter.querySelector('feComposite[in="gloss-light"]');
    let erode = filter.querySelector('[result="gloss-inset"]');
    let blur = filter.querySelector('[result="gloss-mask"]');
    if (!on) {
      erode?.remove();
      blur?.remove();
      clip?.setAttribute("in2", "shape");
      continue;
    }
    if (!erode) {
      erode = document.createElementNS(NS, "feMorphology");
      erode.setAttribute("in", "shape");
      erode.setAttribute("operator", "erode");
      erode.setAttribute("result", "gloss-inset");
      blur = document.createElementNS(NS, "feGaussianBlur");
      blur.setAttribute("in", "gloss-inset");
      blur.setAttribute("result", "gloss-mask");
      light.after(erode, blur);
    }
    erode.setAttribute("radius", String(inset));
    blur.setAttribute("stdDeviation", String(feather));
    clip?.setAttribute("in2", "gloss-mask");
  }
}
