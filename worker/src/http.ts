/** HTTP status codes and response helpers shared by the Worker and the Durable Object. */

/** Named HTTP status codes (AGENTS §9.4: no magic numbers). */
export const HTTP_STATUS = {
  OK: 200,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_CONTENT: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** One of the status codes above. */
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/** R19: headers of every `/install/events` stream response. */
export const SSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

/** JSON response with the given status. */
export function jsonResponse(body: unknown, status: HttpStatus = HTTP_STATUS.OK): Response {
  return Response.json(body, { status });
}

/** Error response in the FastAPI shape `{ "detail": ... }` (body is not contractual). */
export function errorResponse(status: HttpStatus, detail: string): Response {
  return jsonResponse({ detail }, status);
}

/** Plain-text response (R3 configuration errors). */
export function textResponse(body: string, status: HttpStatus): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
