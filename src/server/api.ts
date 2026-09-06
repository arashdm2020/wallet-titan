import { NextResponse } from "next/server";
import { TransferAccessError } from "@/server/transferAccess";

export function apiError(error: unknown) {
  if (error instanceof TransferAccessError) {
    return NextResponse.json({ error: error.message, transferAccess: error.access }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (message === "Only one transfer per 24 hours" || message === "Daily withdrawal limit exceeded") {
    return NextResponse.json(
      { error: "Transfer request limit reached. You can submit only one transfer request during a rolling 24-hour period, and your total transfer value per day is limited to $500,000 USD. Please try again after 24 hours or when your daily limit resets." },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
