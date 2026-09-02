import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are a concise workout coach for a fitness tracking app.\n" +
  "Return only JSON with this exact shape:\n" +
  "{\"summary\": string, \"wins\": string[], \"focus\": string[], \"caution\": string | null}\n\n" +
  "Rules:\n" +
  "- Keep summary to 1 sentence.\n" +
  "- wins: 2 short bullets max.\n" +
  "- focus: 2 short bullets max.\n" +
  "- caution should be null unless there is a clear issue like very low volume, missing reps/weights, or recovery concern.\n" +
  "- Be practical, encouraging, and specific.\n" +
  "- Do not invent PRs or progress if the data does not support it.\n" +
  "- If data is sparse, say that clearly and keep the advice lightweight.";

function completedSetCount(exercises: Array<{ sets?: Array<{ weight?: number | null; reps?: number | null; sets?: number | null }> }>) {
  return exercises.reduce((total, exercise) => (
    total + (exercise.sets ?? []).filter((set) => set.weight || set.reps).length
  ), 0);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key required." }, { status: 503 });
  }

  let body: {
    split?: unknown;
    notes?: unknown;
    exercises?: unknown;
    overloadData?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const split = typeof body.split === "string" ? body.split : "Workout";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const rawExercises = Array.isArray(body.exercises) ? body.exercises : [];
  const overloadData = body.overloadData ?? {};

  const exercises = rawExercises
    .map((exercise) => {
      const record = (exercise ?? {}) as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : "Exercise";
      const sets = Array.isArray(record.sets)
        ? record.sets.map((set) => {
            const setRecord = (set ?? {}) as Record<string, unknown>;
            return {
              weight: Number(setRecord.weight) || null,
              reps: Number(setRecord.reps) || null,
              sets: Number(setRecord.sets) || 1,
              rpe: Number(setRecord.rpe) || null,
            };
          })
        : [];

      return { name, sets };
    })
    .filter((exercise) => exercise.name.trim().length > 0);

  if (exercises.length === 0) {
    return NextResponse.json({ error: "No exercises to analyze yet." }, { status: 400 });
  }

  if (completedSetCount(exercises) === 0) {
    return NextResponse.json({ error: "Log at least one working set first." }, { status: 400 });
  }

  const payload = {
    split,
    notes: notes || null,
    exerciseCount: exercises.length,
    completedSetCount: completedSetCount(exercises),
    exercises,
    overloadData,
  };

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_WORKOUT_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Analyze this saved workout and give a short recap for the athlete:\n" +
              JSON.stringify(payload),
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: "AI service unavailable." }, { status: 502 });
  }

  if (!openaiRes.ok) {
    const detail = await openaiRes.text().catch(() => "");
    console.error("OpenAI workout error", openaiRes.status, detail);
    return NextResponse.json({ error: "Workout recap failed." }, { status: 502 });
  }

  const data = (await openaiRes.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "AI returned an empty response." }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(content) as {
      summary?: unknown;
      wins?: unknown;
      focus?: unknown;
      caution?: unknown;
    };

    return NextResponse.json({
      summary: typeof parsed.summary === "string" ? parsed.summary : "Session logged successfully.",
      wins: Array.isArray(parsed.wins) ? parsed.wins.filter((item): item is string => typeof item === "string").slice(0, 2) : [],
      focus: Array.isArray(parsed.focus) ? parsed.focus.filter((item): item is string => typeof item === "string").slice(0, 2) : [],
      caution: typeof parsed.caution === "string" ? parsed.caution : null,
    });
  } catch {
    return NextResponse.json({ error: "AI response could not be parsed." }, { status: 500 });
  }
}
