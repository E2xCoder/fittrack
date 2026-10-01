import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assemblePlan, isPlannable, type LibraryMeal } from "@/lib/meal-plan";

export const maxDuration = 60;

const MIN_LIBRARY = 6;

const SYSTEM_PROMPT =
  "You plan meals by choosing ONLY from a given library. You never invent foods and never state nutrition numbers.\n" +
  "Rules:\n" +
  "- Use only the provided mealId values. quantity is a multiple of ONE serving (0.25 steps, 0.25-4).\n" +
  "- Each day: fill the requested meal slots (breakfast, lunch, dinner, and snack if asked) so the day's calories land close to the daily target and protein is near its target.\n" +
  "- Vary the days; avoid repeating the same dinner on consecutive days. Respect the dietary preferences and notes.\n" +
  "- Library entries are often single ingredients. Build each slot from 2-4 items that make a sensible meal together (a protein + a carb, plus fruit/veg/dairy when available), not one ingredient alone.\n" +
  "- Prefer items that fit the slot by name (e.g. oats/eggs/yogurt for breakfast).\n" +
  "Return ONLY JSON: {\"days\":[{\"meals\":[{\"slot\":\"breakfast|lunch|dinner|snack\",\"items\":[{\"mealId\":string,\"quantity\":number}]}]}]}";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Session not found." }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "An OpenAI API key is required for this feature." }, { status: 503 });

  let body: { days?: unknown; includeSnack?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const days = [3, 5, 7].includes(Number(body.days)) ? Number(body.days) : 7;
  const includeSnack = body.includeSnack !== false;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : "";

  const [user, meals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { calorieTarget: true, proteinTarget: true, carbTarget: true, fatTarget: true, dietaryPreferences: true },
    }),
    prisma.meal.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, calories: true, protein: true, carbs: true, fat: true, servingSize: true, servingLabel: true },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
  ]);

  if (!user?.calorieTarget) {
    return NextResponse.json({ error: "Set your daily calorie target in Profile first." }, { status: 422 });
  }
  const library: LibraryMeal[] = meals.filter(isPlannable);
  if (library.length < MIN_LIBRARY) {
    return NextResponse.json(
      { error: `Your meal library has ${library.length} usable meal${library.length === 1 ? "" : "s"} — add at least ${MIN_LIBRARY} so the plan has variety.` },
      { status: 422 }
    );
  }

  const target = {
    calories: user.calorieTarget,
    protein: user.proteinTarget ?? Math.round((user.calorieTarget * 0.3) / 4),
    carbs: user.carbTarget ?? Math.round((user.calorieTarget * 0.4) / 4),
    fat: user.fatTarget ?? Math.round((user.calorieTarget * 0.3) / 9),
  };
  const libraryText = library
    .map((m) => {
      const serving = m.servingLabel === "piece" ? "1 piece" : `${m.servingSize}${m.servingLabel}`;
      return `${m.id} | ${m.name} | per serving (${serving}): ${Math.round(m.calories)} kcal, P${Math.round(m.protein)} C${Math.round(m.carbs)} F${Math.round(m.fat)}`;
    })
    .join("\n");

  const userPrompt =
    `Plan ${days} days. Daily target: ${target.calories} kcal, protein ${target.protein}g, carbs ${target.carbs}g, fat ${target.fat}g.\n` +
    `Slots per day: breakfast, lunch, dinner${includeSnack ? ", snack" : ""}.\n` +
    (user.dietaryPreferences?.length ? `Dietary preferences: ${user.dietaryPreferences.join(", ")}.\n` : "") +
    (notes ? `Notes from the user: ${notes}\n` : "") +
    `\nLibrary (id | name | macros per ONE serving):\n${libraryText}`;

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.7,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the AI service, please try again." }, { status: 502 });
  }

  if (!openaiRes.ok) {
    console.error("OpenAI plan error", openaiRes.status, await openaiRes.text().catch(() => ""));
    return NextResponse.json(
      { error: openaiRes.status === 429 ? "OpenAI quota exceeded or too many requests. Try again shortly." : "Plan generation failed, please try again." },
      { status: 502 }
    );
  }

  const data = (await openaiRes.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "");
  } catch {
    return NextResponse.json({ error: "Could not process the AI response, please try again." }, { status: 502 });
  }

  const plan = assemblePlan(parsed, library, target, days);
  if (plan.length === 0) {
    return NextResponse.json({ error: "The AI didn't return a usable plan, please try again." }, { status: 502 });
  }

  return NextResponse.json({ target, days: plan });
}
