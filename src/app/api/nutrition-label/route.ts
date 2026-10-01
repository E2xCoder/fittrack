import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

// Transcription only — the model must never estimate or fill in values.
const SYSTEM_PROMPT =
  "You transcribe printed Nutrition Facts labels. Rules:\n" +
  "- Copy ONLY numbers that are printed and clearly legible. NEVER estimate, infer, calculate, or use outside knowledge about the product.\n" +
  "- If a value is missing or unreadable, use null.\n" +
  "- A label may have a per-100g/100ml column, a per-serving column, or both. Fill each column separately; use null for a column that is absent.\n" +
  "- calories is kcal. If only kJ is printed, put it in energyKj and leave calories null.\n" +
  "- carbs is total carbohydrate (not sugars). fat is total fat. All macros in grams.\n" +
  "- servingSize is the number printed for one serving (e.g. 30), servingUnit is \"g\" or \"ml\". null if not printed.\n" +
  "- unit is \"ml\" for liquids (label says per 100 ml), otherwise \"g\".\n" +
  "Return ONLY this JSON:\n" +
  "{\"productName\": string|null, \"unit\": \"g\"|\"ml\", \"servingSize\": number|null, \"servingUnit\": \"g\"|\"ml\"|null, " +
  "\"per100\": {\"calories\": number|null, \"energyKj\": number|null, \"protein\": number|null, \"carbs\": number|null, \"fat\": number|null}|null, " +
  "\"perServing\": {\"calories\": number|null, \"energyKj\": number|null, \"protein\": number|null, \"carbs\": number|null, \"fat\": number|null}|null}";

interface Column {
  calories: number | null;
  energyKj: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseColumn(raw: unknown): Column | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const col: Column = {
    calories: numOrNull(r.calories),
    energyKj: numOrNull(r.energyKj),
    protein: numOrNull(r.protein),
    carbs: numOrNull(r.carbs),
    fat: numOrNull(r.fat),
  };
  return Object.values(col).every((v) => v === null) ? null : col;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Session not found." }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "An OpenAI API key is required for this feature." }, { status: 503 });
  }

  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const image = typeof body.image === "string" && body.image.startsWith("data:image") ? body.image : null;
  if (!image) return NextResponse.json({ error: "Attach a photo of the nutrition label." }, { status: 400 });

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this nutrition label." },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the AI service, please try again." }, { status: 502 });
  }

  if (!openaiRes.ok) {
    console.error("OpenAI label error", openaiRes.status, await openaiRes.text().catch(() => ""));
    const msg =
      openaiRes.status === 429
        ? "OpenAI quota exceeded or too many requests. Try again shortly."
        : "Label reading failed, please try again.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const data = (await openaiRes.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content ?? "") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Could not read the label, try a clearer photo." }, { status: 422 });
  }

  const unit: "g" | "ml" = parsed.unit === "ml" ? "ml" : "g";
  const servingSize = numOrNull(parsed.servingSize);
  const per100Col = parseColumn(parsed.per100);
  const perServingCol = parseColumn(parsed.perServing);

  // Prefer the printed per-100 column; otherwise scale the per-serving column
  // by the printed serving size. Nothing is guessed.
  const hasEnergy = (c: Column | null) => !!c && (c.calories !== null || c.energyKj !== null);
  let col: Column | null = hasEnergy(per100Col) ? per100Col : null;
  let converted = false;
  if (!col && perServingCol && servingSize && servingSize > 0) {
    const k = 100 / servingSize;
    const scale = (v: number | null) => (v === null ? null : v * k);
    col = {
      calories: scale(perServingCol.calories),
      energyKj: scale(perServingCol.energyKj),
      protein: scale(perServingCol.protein),
      carbs: scale(perServingCol.carbs),
      fat: scale(perServingCol.fat),
    };
    converted = true;
  }

  const kcal = col ? (col.calories ?? (col.energyKj !== null ? col.energyKj / 4.184 : null)) : null;
  if (!col || kcal === null) {
    return NextResponse.json(
      { error: "Couldn't read calories from the photo — try a closer, well-lit shot of the label." },
      { status: 422 }
    );
  }

  const per100 = {
    calories: Math.round(kcal),
    protein: col.protein === null ? null : round1(col.protein),
    carbs: col.carbs === null ? null : round1(col.carbs),
    fat: col.fat === null ? null : round1(col.fat),
  };

  const warnings: string[] = [];
  if (converted) warnings.push(`Converted from the per-serving column (${servingSize} ${unit}) to per 100 ${unit}.`);
  const missing = (["protein", "carbs", "fat"] as const).filter((k) => per100[k] === null);
  if (missing.length) warnings.push(`Couldn't read: ${missing.join(", ")}. Fill in manually.`);
  const macroSum = (per100.protein ?? 0) + (per100.carbs ?? 0) + (per100.fat ?? 0);
  if (per100.calories > 900 || macroSum > 105) warnings.push("These numbers look off — double-check against the label.");

  return NextResponse.json({
    name: typeof parsed.productName === "string" ? parsed.productName.trim() : "",
    unit,
    per100,
    warnings,
  });
}
