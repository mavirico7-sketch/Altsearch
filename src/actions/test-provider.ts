"use server";

import { auth } from "@/auth";

export async function testProviderAction(baseUrl: string, apiKey: string, config: { model: string; temperature?: number; reasoning?: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Normalize baseUrl
  let url = baseUrl.trim();
  if (url.endsWith("/")) url = url.slice(0, -1);

  const body: any = {
    model: config.model,
    messages: [{ role: "user", content: "Test" }],
    max_tokens: 1
  };

  if (config.temperature !== undefined && !isNaN(config.temperature)) {
    body.temperature = config.temperature;
  }

  if (config.reasoning) {
    body.reasoning_effort = config.reasoning;
  }

  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      return { success: true, message: "Connected successfully! Dummy generation worked." };
    } else {
      const text = await res.text().catch(() => "Unknown error");
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
