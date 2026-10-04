import { NextRequest, NextResponse } from "next/server";

const OFF_FIELDS =
  "product_name,brands,nutriments,image_thumb_url,code,categories,quantity,serving_quantity_unit";
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

/**
 * Returns "ml" if the product is clearly a liquid, "g" otherwise.
 * Priority: explicit unit fields → name/category keyword match.
 */
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

// ── USDA FoodData Central ─────────────────────────────────────────────────

interface FDCFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodNutrients?: { nutrientId: number; value: number }[];
}

/** nutrientId reference: 1008=Energy(kcal) 1003=Protein 1005=Carbs 1004=Fat */
function fdcNutrient(food: FDCFood, id: number): number {
  return food.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;
}

function fdcToUnified(food: FDCFood) {
  const name = food.description ?? "";
  return {
    code: food.gtinUpc ?? `fdc_${food.fdcId}`,
    product_name: name,
    brands: food.brandOwner ?? food.brandName ?? "",
    image_thumb_url: null,
    source: "USDA" as const,
    servingLabel: detectServingLabel(name),
    nutriments: {
      "energy-kcal_100g": Math.round(fdcNutrient(food, 1008)),
      "proteins_100g":    Math.round(fdcNutrient(food, 1003) * 10) / 10,
      "carbohydrates_100g": Math.round(fdcNutrient(food, 1005) * 10) / 10,
      "fat_100g":         Math.round(fdcNutrient(food, 1004) * 10) / 10,
    },
  };
}

async function fetchUSDA(q: string) {
  const key = process.env.FDC_API_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("query", q);
    url.searchParams.set("api_key", key);
    url.searchParams.set("dataType", "Branded");
    url.searchParams.set("pageSize", "8");
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.foods ?? []).map(fdcToUnified);
  } catch {
    return [];
  }
}

// ── Open Food Facts ────────────────────────────────────────────────────────

async function fetchOFF(q: string) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=10&fields=${OFF_FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      source: "OFF" as const,
      servingLabel: detectServingLabel(
        String(p.product_name ?? ""),
        String(p.categories ?? ""),
        String(p.quantity ?? ""),
        String(p.serving_quantity_unit ?? "")
      ),
    }));
  } catch {
    return [];
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const [offProducts, usdaProducts] = await Promise.all([fetchOFF(q), fetchUSDA(q)]);

  // Interleave & deduplicate by lowercased name prefix
  const seen = new Set<string>();
  const merged = [...offProducts, ...usdaProducts].filter((p) => {
    const key = ((p as { product_name?: string }).product_name ?? "").toLowerCase().slice(0, 30);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ products: merged.slice(0, 16) });
}
