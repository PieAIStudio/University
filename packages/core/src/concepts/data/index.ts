import type { RawConcept } from "../../domain/concept.js";
import { AI_CONCEPTS } from "./ai.js";
import { BACKEND_CONCEPTS } from "./backend.js";
import { DESIGN_CONCEPTS } from "./design.js";
import { FRONTEND_CONCEPTS } from "./frontend.js";
import { GIT_CONCEPTS } from "./git.js";
import { PRODUCT_CONCEPTS } from "./product.js";
import { TECHNOLOGY_CONCEPTS } from "./technology.js";

/**
 * The 281 concept records, in chip order.
 *
 * Split one file per category because a diff on 「表单」 should not be a diff
 * on the whole catalogue, and because 137 frontend entries in the same file as
 * 12 Git entries makes both harder to find.
 *
 * The *names* and the category structure were taken from vibe-hub.org, whose
 * author cleared us to absorb it, and were verified three ways before a word
 * was written: a browser read of the seven category pages here, plus two models
 * scraping independently from the same brief. All three agree on 281 slugs with
 * no disagreement, including the one entry a first pass missed.
 *
 * The *prose* is ours. Their examples are invented; this product has a real
 * repository, real courses and real evidence anchors, and an entry that can
 * point at one of those teaches something an invented example cannot.
 */
export const RAW_CONCEPTS: readonly RawConcept[] = [
  ...FRONTEND_CONCEPTS,
  ...BACKEND_CONCEPTS,
  ...PRODUCT_CONCEPTS,
  ...TECHNOLOGY_CONCEPTS,
  ...AI_CONCEPTS,
  ...GIT_CONCEPTS,
  ...DESIGN_CONCEPTS,
];
