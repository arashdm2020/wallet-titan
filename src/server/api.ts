import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 400 });
}

