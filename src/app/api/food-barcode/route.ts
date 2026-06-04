import { NextRequest, NextResponse } from "next/server";

const UA = "FitTrack/1.0 (fitness tracking app)";

// ── OFF ────────────────────────────────────────────────────────────────────

async function fetchOFFBarcode(code: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
      { headers: { "User-Agent": UA }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return { source: "OFF" as const, product: data.product };
  } catch {
    return null;
  }
}

// ── Nutritionix ────────────────────────────────────────────────────────────

async function fetchNixBarcode(code: string) {
  const appId  = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) return null;

  try {
    const res = await fetch(
      `https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(code)}`,
      {
        headers: { "x-app-id": appId, "x-app-key": appKey },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.foods?.[0];
    if (!item) return null;

    const swg = item.serving_weight_grams || 100;
    const f   = 100 / swg;

    // Return in an OFF-compatible shape so the modal normalize() works
    return {
      source: "Nutritionix" as const,
      product: {
        product_name: item.food_name ?? "",
        brands: item.brand_name ?? "",
        image_thumb_url: item.photo?.thumb ?? null,
        nutriments: {
          "energy-kcal_100g": Math.round((item.nf_calories ?? 0) * f),
          "proteins_100g":  Math.round((item.nf_protein ?? 0) * f * 10) / 10,
          "carbohydrates_100g": Math.round((item.nf_total_carbohydrate ?? 0) * f * 10) / 10,
          "fat_100g": Math.round((item.nf_total_fat ?? 0) * f * 10) / 10,
        },
      },
    };
  } catch {
    return null;
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ status: 0, error: "Missing code" }, { status: 400 });

  // Try OFF first (faster), then Nutritionix as fallback
  const off = await fetchOFFBarcode(code);
  if (off) return NextResponse.json({ status: 1, source: off.source, product: off.product });

  const nix = await fetchNixBarcode(code);
  if (nix) return NextResponse.json({ status: 1, source: nix.source, product: nix.product });

  return NextResponse.json({ status: 0 });
}
