import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GPT-4o vision calls can take a while — give the function room to breathe.
export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are a precise nutrition calculator. Follow these rules EXACTLY:\n\n" +
  "RULE 1 - SERVING SIZE CALCULATION:\n" +
  "If the user says \"I ate X pieces\" and the label shows \"Y pieces = Zg\":\n" +
  "- Calculate: (X / Y) * Z = total grams eaten\n" +
  "- Example: \"12 pieces\", label says \"4 pieces = 15g\" → (12/4)*15 = 45g eaten\n" +
  "- Use ONLY this 45g to calculate macros, NOT the package total\n\n" +
  "RULE 2 - NEVER USE PACKAGE TOTAL:\n" +
  "Never use total package weight (e.g. 90g package) unless user says \"I ate the whole package\"\n\n" +
  "RULE 3 - PARTIAL AMOUNTS:\n" +
  "If user says \"I ate X out of Y grams\" → calculate for X grams only\n\n" +
  "RULE 4 - OUTPUT FORMAT:\n" +
  "Return ONLY this JSON, no other text:\n" +
  "{\"totalCalories\": number, \"totalProtein\": number, \"totalCarbs\": number, \"totalFat\": number, \"items\": [{\"name\": \"product name (Xg)\", \"amount\": number, \"unit\": \"g\", \"calories\": number, \"protein\": number, \"carbs\": number, \"fat\": number}]}\n\n" +
  "RULE 5 - SHOW CALCULATION:\n" +
  "In the item name, always show the actual amount: \"Milka Chocolate (45g)\" not just \"Milka Chocolate\"";

interface ChatTextPart {
  type: "text";
  text: string;
}
interface ChatImagePart {
  type: "image_url";
  image_url: { url: string };
}
type ChatContentPart = ChatTextPart | ChatImagePart;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Bu özellik için OpenAI API key gerekli." },
      { status: 503 }
    );
  }

  let body: { image?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const image =
    typeof body.image === "string" && body.image.startsWith("data:image")
      ? body.image
      : null;

  if (!message && !image) {
    return NextResponse.json(
      { error: "Lütfen bir açıklama yazın veya fotoğraf ekleyin." },
      { status: 400 }
    );
  }

  const userContent: ChatContentPart[] = [
    {
      type: "text",
      text:
        message ||
        "Fotoğraftaki yemeği analiz et ve makrolarını hesapla.",
    },
  ];
  if (image) {
    userContent.push({ type: "image_url", image_url: { url: image } });
  }

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "AI servisine ulaşılamadı, tekrar deneyin." },
      { status: 502 }
    );
  }

  if (!openaiRes.ok) {
    const detail = await openaiRes.text().catch(() => "");
    console.error("OpenAI error", openaiRes.status, detail);
    if (openaiRes.status === 401) {
      return NextResponse.json(
        { error: "OpenAI API key geçersiz." },
        { status: 502 }
      );
    }
    if (openaiRes.status === 429) {
      return NextResponse.json(
        { error: "OpenAI kotası doldu veya çok fazla istek. Biraz sonra tekrar deneyin." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "AI analizi başarısız oldu, tekrar deneyin." },
      { status: 502 }
    );
  }

  const data = (await openaiRes.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[] }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "AI boş yanıt döndü, tekrar deneyin." },
      { status: 502 }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "AI yanıtı işlenemedi, tekrar deneyin." },
      { status: 500 }
    );
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    return {
      name: typeof it.name === "string" ? it.name : "—",
      amount: num(it.amount),
      unit: typeof it.unit === "string" ? it.unit : "",
      calories: num(it.calories),
      protein: num(it.protein),
      carbs: num(it.carbs),
      fat: num(it.fat),
    };
  });

  return NextResponse.json({
    totalCalories: num(parsed.totalCalories),
    totalProtein: num(parsed.totalProtein),
    totalCarbs: num(parsed.totalCarbs),
    totalFat: num(parsed.totalFat),
    items,
  });
}
