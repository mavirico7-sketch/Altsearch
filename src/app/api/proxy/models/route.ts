import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");
    
    // For manual keys:
    const key = searchParams.get("key");
    const baseUrl = searchParams.get("baseUrl");

    if (!provider) {
      return NextResponse.json({ error: "Missing provider" }, { status: 400 });
    }

    let fetchUrl = "";
    let fetchKey = "";

    if (provider.endsWith("-web")) {
      if (process.env.PROXY_ENABLED !== "true") {
        return NextResponse.json({ error: "Proxy mode is disabled" }, { status: 403 });
      }
      const proxyBaseUrl = process.env.PROXY_BASE_URL || "http://cliproxy:8317/v1";
      fetchUrl = `${proxyBaseUrl}/models`;
      fetchKey = process.env.PROXY_API_KEY || "1";
    } else if (baseUrl && key) {
      // Standard API Provider
      let base = baseUrl.replace(/\/$/, "");
      fetchUrl = `${base}/models`;
      fetchKey = key;
    } else {
      return NextResponse.json({ error: "Missing key or baseUrl for provider" }, { status: 400 });
    }

    const response = await fetch(fetchUrl, {
      headers: {
        "Authorization": `Bearer ${fetchKey}`
      }
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Provider returned ${response.status}: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching models:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
