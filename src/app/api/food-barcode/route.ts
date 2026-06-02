import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FitTrack/1.0 (fitness tracking app)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ status: 0 }, { status: 502 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 0 }, { status: 502 });
  }
}
