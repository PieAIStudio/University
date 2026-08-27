import {
  createProductionGradeDependencies,
  handleGradeRequest,
  type GradeDependencies,
} from "./service.js";

let dependencies: GradeDependencies | undefined;

export function vercelGradeHandler(request: Request): Promise<Response> {
  dependencies ??= createProductionGradeDependencies();
  return handleGradeRequest(request, dependencies);
}

/** Vercel's Node runtime supplies the Web Request through the `fetch` export. */
export default {
  fetch: vercelGradeHandler,
};
