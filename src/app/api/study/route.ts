import { NextResponse } from "next/server";
import { resolveStudyContent } from "@/lib/resolve";
import { isStudyId } from "@/lib/studies";
import { todayISO } from "@/lib/dates";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/study?date=YYYY-MM-DD&id=daf&extra=1 -> full readable content for one study.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  const id = url.searchParams.get("id") ?? "";
  const wantExtra = url.searchParams.get("extra") === "1";

  if (!ISO_RE.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (!isStudyId(id)) {
    return NextResponse.json({ error: "invalid study id" }, { status: 400 });
  }

  const content = await resolveStudyContent(date, id, wantExtra);
  return NextResponse.json(content, {
    headers: { "cache-control": "public, max-age=0, s-maxage=3600" },
  });
}
