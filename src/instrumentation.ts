import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  const { startScheduler } = await import("./server/jobs/scheduler");
  startScheduler();
}

/** Local error log (stands in for a hosted error tracker): ./logs/errors.log */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as Error & { digest?: string };
  const { logServerError } = await import("./server/error-log");
  await logServerError({
    message: e?.message ?? String(err),
    digest: e?.digest,
    stack: e?.stack?.split("\n").slice(0, 8).join("\n"),
    method: request.method,
    path: request.path,
    route: context.routePath,
    kind: context.routeType,
  });
};
