import { NextRequest } from "next/server";
import { generateImage } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json().catch(() => ({ prompt: "" }));
  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";

  if (!cleanPrompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  try {
    return Response.json(await generateImage(cleanPrompt));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
