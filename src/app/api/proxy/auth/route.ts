import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");
    if (!provider) {
      return NextResponse.json({ error: "Missing provider" }, { status: 400 });
    }

    if (process.env.PROXY_ENABLED !== "true") {
      return NextResponse.json({ error: "Proxy mode is disabled" }, { status: 403 });
    }

    // Determine the management endpoint
    let endpoint = "";
    if (provider === "google-web") {
      endpoint = "gemini-cli-auth-url";
    } else if (provider === "anthropic-web") {
      endpoint = "anthropic-auth-url";
    } else if (provider === "openai-web") {
      endpoint = "codex-auth-url";
    } else {
      return NextResponse.json({ error: "Invalid web provider" }, { status: 400 });
    }

    // Assuming cliproxy management runs on port 8317 on the same host (or inside docker as cliproxy:8317)
    // Actually, we use 'http://cliproxy:8317' assuming Docker network, but if it's local we might need a config.
    // We can parse the proxy base_url, replace 8080/v1 with 8317/v0/management
    const proxyBaseUrl = process.env.PROXY_BASE_URL || "http://cliproxy:8317/v1";
    let mngUrl = new URL(proxyBaseUrl);
    mngUrl.port = "8317";
    mngUrl.pathname = `/v0/management/${endpoint}`;
    mngUrl.searchParams.set("is_webui", "true");

    const mngKey = process.env.PROXY_MANAGEMENT_KEY || process.env.PROXY_API_KEY || "123";

    const response = await fetch(mngUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${mngKey}`
      }
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Proxy returned ${response.status}: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in proxy auth:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
