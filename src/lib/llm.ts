import { getConfig } from "./config";

type OpenRouterImage = {
  image_url?: {
    url?: string;
  };
};

type OpenRouterChoice = {
  message?: {
    content?: unknown;
    images?: OpenRouterImage[];
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
};

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part !== "object" || part === null) return "";
      const record = part as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function imageUrlFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (typeof part !== "object" || part === null) continue;
    const record = part as Record<string, unknown>;
    const imageUrl = record.image_url;

    if (typeof imageUrl === "string") return imageUrl;
    if (typeof imageUrl === "object" && imageUrl !== null) {
      const url = (imageUrl as Record<string, unknown>).url;
      if (typeof url === "string") return url;
    }
  }

  return null;
}

export async function generateImage(prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Image generation failed with HTTP ${res.status}.`);
  }

  const message = data.choices?.[0]?.message;
  const imageUrl = message?.images?.find((image) => image.image_url?.url)
    ?.image_url?.url ?? imageUrlFromContent(message?.content);

  if (!imageUrl) {
    const text = textFromContent(message?.content);
    throw new Error(text || "The model did not return an image.");
  }

  return {
    imageUrl,
    text: textFromContent(message?.content),
    model: "google/gemini-3.1-flash-image-preview",
  };
}
