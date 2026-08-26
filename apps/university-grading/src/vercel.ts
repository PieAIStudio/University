import {
  createProductionGradeDependencies,
  handleGradeRequest,
  type GradeDependencies,
} from "./service.js";

let dependencies: GradeDependencies | undefined;

export default function vercelGradeHandler(request: Request): Promise<Response> {
  dependencies ??= createProductionGradeDependencies();
  return handleGradeRequest(request, dependencies);
}
