import type { NextRequest } from "next/server";

export function isSecureRequest(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim() === "https";
  return request.nextUrl.protocol === "https:";
}

