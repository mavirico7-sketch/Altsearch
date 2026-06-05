import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "../hub.css";
import "./settings.css";
import SettingsClient from "./SettingsClient";

import { getConfig } from "@/lib/config";

async function getOpenRouterBalance(key: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { "Authorization": `Bearer ${key}` },
      next: { revalidate: 60 }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data) {
      const credits = json.data.total_credits || 0;
      const usage = json.data.total_usage || 0;
      return `$${(credits - usage).toFixed(4)}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session) {
    redirect("/hub/login");
  }

  const config = getConfig();
  const presets = config.openrouter_presets || {};
  const defaultPreset = config.openrouter_default_preset || "balanced";

  let openrouterKey = null;
  try {
    if (session?.user?.providerSettings) {
      const settings = typeof session.user.providerSettings === "string" 
        ? JSON.parse(session.user.providerSettings) 
        : session.user.providerSettings;
      openrouterKey = settings?.openrouter?.key || null;
    }
  } catch {}

  let initialBalance = "$--";
  if (openrouterKey) {
    const bal = await getOpenRouterBalance(openrouterKey);
    if (bal) initialBalance = `Balance: ${bal}`;
  }

  return (
    <div className="page">
      <aside className="sidebar" aria-label="Hub navigation">
        <div className="section-label">Creator Hub</div>
        <nav className="side-nav">
          <Link href="/hub">Overview</Link>
          <Link href="/hub/events">My events</Link>
          <Link className="active" href="/hub/settings">Settings</Link>
        </nav>
      </aside>

      <SettingsClient 
        initialProvider={session.user.activeProvider || "openrouter"}
        initialSettingsJson={typeof session.user.providerSettings === "string" ? session.user.providerSettings : JSON.stringify(session.user.providerSettings || {})}
        initialBalance={initialBalance}
        presetsConfig={presets}
        defaultPreset={defaultPreset}
        proxyEnabled={process.env.PROXY_ENABLED === "true"}
        proxyBaseUrl={process.env.PROXY_BASE_URL || "http://cliproxy:8317/v1"}
        proxyApiKey={process.env.PROXY_API_KEY || "1"}
      />
    </div>
  );
}
