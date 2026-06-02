import { NextRequest, NextResponse } from "next/server";

const FIELDS = "product_name,brands,nutriments,image_thumb_url,code";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=12&fields=${FIELDS}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FitTrack/1.0 (fitness tracking app)" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ products: [] }, { status: 502 });
    const data = await res.json();
    return NextResponse.json({ products: data.products ?? [] });
  } catch {
    return NextResponse.json({ products: [] }, { status: 502 });
  }
}
