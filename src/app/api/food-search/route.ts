import { NextRequest, NextResponse } from "next/server";

const OFF_FIELDS = "product_name,brands,nutriments,image_thumb_url,code";
const UA = "FitTrack/1.0 (fitness tracking app)";

// ── Nutritionix helpers ────────────────────────────────────────────────────

interface NixBranded {
  food_name: string;
  brand_name?: string;
  serving_weight_grams?: number;
  nf_calories?: number;
  nf_total_fat?: number;
  nf_total_carbohydrate?: number;
  nf_protein?: number;
  photo?: { thumb?: string };
  nix_item_id?: string;
}

function nixToUnified(item: NixBranded, idx: number) {
  const swg = item.serving_weight_grams || 100;
  const factor = 100 / swg;
  return {
    code: item.nix_item_id ?? `nix_${idx}`,
    product_name: item.food_name ?? "",
    brands: item.brand_name ?? "",
    image_thumb_url: item.photo?.thumb ?? null,
    source: "Nutritionix" as const,
    nutriments: {
      "energy-kcal_100g": Math.round((item.nf_calories ?? 0) * factor),
      "proteins_100g":  Math.round((item.nf_protein ?? 0) * factor * 10) / 10,
      "carbohydrates_100g": Math.round((item.nf_total_carbohydrate ?? 0) * factor * 10) / 10,
      "fat_100g": Math.round((item.nf_total_fat ?? 0) * factor * 10) / 10,
    },
  };
}

async function fetchNutritonix(q: string) {
  const appId  = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) return [];

  try {
    const res = await fetch("https://trackapi.nutritionix.com/v2/search/instant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": appId,
        "x-app-key": appKey,
      },
      body: JSON.stringify({ query: q, branded: true, common: false }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.branded ?? []).slice(0, 8).map((item: NixBranded, i: number) => nixToUnified(item, i));
  } catch {
    return [];
  }
}

// ── OFF helper ─────────────────────────────────────────────────────────────

async function fetchOFF(q: string) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=10&fields=${OFF_FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products ?? []).map((p: object) => ({ ...p, source: "OFF" as const }));
  } catch {
    return [];
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const [offProducts, nixProducts] = await Promise.all([fetchOFF(q), fetchNutritonix(q)]);

  // Interleave: OFF first, then Nix (deduplicate by name)
  const seen = new Set<string>();
  const merged = [...offProducts, ...nixProducts].filter((p) => {
    const key = (p.product_name ?? "").toLowerCase().slice(0, 30);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ products: merged.slice(0, 16) });
}
