import { NextResponse } from "next/server";
import { resolveDay } from "@/lib/resolve";
import { todayISO } from "@/lib/dates";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/day?date=YYYY-MM-DD -> the three studies (refs + Hebrew refs) for the date.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  if (!ISO_RE.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const day = await resolveDay(date);
  return NextResponse.json(day, {
    headers: { "cache-control": "public, max-age=0, s-maxage=3600" },
  });
}
