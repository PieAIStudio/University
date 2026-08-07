import {
  courseReviewableCard,
  knowledgeReviewableCard,
  revealReviewableCard,
  reviewReviewableCard,
} from "../content-access.js";
import { CardRevealSchema, CardReviewSchema } from "../request-schemas.js";
import { parseKnowledgeCardRoute, parseRoute } from "../routes.js";
import { readJsonBody, requireMutationAccess } from "../wire.js";
import type { Handler } from "./types.js";

/** Course-card and knowledge-card reveal/review. */
export const handleCard: Handler = async (ctx, request, response, url) => {
  const cardRevealRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/reveal$/,
  );
  if (request.method === "POST" && cardRevealRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = CardRevealSchema.parse(await readJsonBody(request));
    const store = ctx.getStore(cardRevealRoute.studyId, true)!;
    revealReviewableCard(
      response,
      body,
      courseReviewableCard(ctx.studiesRoot, cardRevealRoute),
      store,
    );
    return true;
  }

  const cardReviewRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/review$/,
  );
  if (request.method === "POST" && cardReviewRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = CardReviewSchema.parse(await readJsonBody(request));
    const store = ctx.getStore(cardReviewRoute.studyId, true)!;
    reviewReviewableCard(
      response,
      body,
      courseReviewableCard(ctx.studiesRoot, cardReviewRoute),
      store,
    );
    return true;
  }

  const knowledgeCardRoute = parseKnowledgeCardRoute(url.pathname);
  if (request.method === "POST" && knowledgeCardRoute?.action === "reveal") {
    requireMutationAccess(request, ctx.requestToken);
    const body = CardRevealSchema.parse(await readJsonBody(request));
    const store = ctx.getStore(knowledgeCardRoute.studyId, true)!;
    revealReviewableCard(
      response,
      body,
      knowledgeReviewableCard(ctx.studiesRoot, knowledgeCardRoute),
      store,
    );
    return true;
  }
  if (request.method === "POST" && knowledgeCardRoute?.action === "review") {
    requireMutationAccess(request, ctx.requestToken);
    const body = CardReviewSchema.parse(await readJsonBody(request));
    const store = ctx.getStore(knowledgeCardRoute.studyId, true)!;
    reviewReviewableCard(
      response,
      body,
      knowledgeReviewableCard(ctx.studiesRoot, knowledgeCardRoute),
      store,
    );
    return true;
  }

  return false;
};
