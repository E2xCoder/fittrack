import { NextRequest, NextResponse } from "next/server";

const UA = "FitTrack/1.0 (fitness tracking app)";

// ── Liquid detection ─────────────────────────────────────────────────────────

const LIQUID_KEYWORDS = [
  // English
  "water", "juice", "drink", "milk", "yogurt", "beverage", "soda", "beer",
  "wine", "coffee", "tea", "smoothie", "shake", "soup", "broth", "syrup",
  "lemonade", "cola", "sauce",
  // Turkish
  "su", "süt", "içecek", "meyve suyu", "limonata", "kahve", "çay", "bira", "şarap",
];

function detectServingLabel(
  name: string,
  categories?: string,
  quantity?: string,
  servingQuantityUnit?: string
): "ml" | "g" {
  if (servingQuantityUnit?.toLowerCase() === "ml") return "ml";
  if (quantity?.toLowerCase().includes("ml")) return "ml";
  const text = `${name} ${categories ?? ""}`.toLowerCase();
  if (LIQUID_KEYWORDS.some((kw) => text.includes(kw))) return "ml";
  return "g";
}

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

// ── USDA FoodData Central ─────────────────────────────────────────────────

interface FDCFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodNutrients?: { nutrientId: number; value: number }[];
}

function fdcNutrient(food: FDCFood, id: number): number {
  return food.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;
}

async function fetchUSDABarcode(code: string) {
  const key = process.env.FDC_API_KEY;
  if (!key) return null;
  try {
    // USDA lets you search by GTIN/UPC via the query parameter
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("query", code);
    url.searchParams.set("api_key", key);
    url.searchParams.set("dataType", "Branded");
    url.searchParams.set("pageSize", "5");
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();

    // Find the item whose gtinUpc matches the scanned code
    const match: FDCFood | undefined = (data.foods ?? []).find(
      (f: FDCFood) => f.gtinUpc === code || f.gtinUpc === code.replace(/^0+/, "")
    ) ?? data.foods?.[0];
    if (!match) return null;

    return {
      source: "USDA" as const,
      product: {
        product_name: match.description ?? "",
        brands: match.brandOwner ?? match.brandName ?? "",
        image_thumb_url: null,
        nutriments: {
          "energy-kcal_100g": Math.round(fdcNutrient(match, 1008)),
          "proteins_100g":    Math.round(fdcNutrient(match, 1003) * 10) / 10,
          "carbohydrates_100g": Math.round(fdcNutrient(match, 1005) * 10) / 10,
          "fat_100g":         Math.round(fdcNutrient(match, 1004) * 10) / 10,
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

  // Try OFF first (has richer product data), then USDA as fallback
  const off = await fetchOFFBarcode(code);
  if (off) {
    const p = off.product as Record<string, unknown>;
    const servingLabel = detectServingLabel(
      String(p.product_name ?? ""),
      String(p.categories ?? ""),
      String(p.quantity ?? ""),
      String(p.serving_quantity_unit ?? "")
    );
    return NextResponse.json({ status: 1, source: off.source, product: { ...p, servingLabel } });
  }

  const usda = await fetchUSDABarcode(code);
  if (usda) {
    const p = usda.product as Record<string, unknown>;
    const servingLabel = detectServingLabel(String(p.product_name ?? ""));
    return NextResponse.json({ status: 1, source: usda.source, product: { ...p, servingLabel } });
  }

  return NextResponse.json({ status: 0 });
}
