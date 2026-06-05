import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");
    if (!state) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    if (process.env.PROXY_ENABLED !== "true") {
      return NextResponse.json({ error: "Proxy mode is disabled" }, { status: 403 });
    }

    const proxyBaseUrl = process.env.PROXY_BASE_URL || "http://cliproxy:8317/v1";
    let mngUrl = new URL(proxyBaseUrl);
    mngUrl.port = "8317";
    mngUrl.pathname = `/v0/management/get-auth-status`;
    mngUrl.searchParams.set("state", state);

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
    console.error("Error in proxy auth status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
