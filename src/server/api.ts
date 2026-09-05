import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (message === "Only one transfer per 24 hours" || message === "Daily withdrawal limit exceeded") {
    return NextResponse.json(
      { error: "Transfer request limit reached. Each wallet, including ADMIN, may submit only one transfer request during a rolling 24-hour period. Each request is limited to a maximum value of $500,000 USD. Please try again after 24 hours." },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
