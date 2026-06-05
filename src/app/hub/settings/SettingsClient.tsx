"use client";

import { useState, useEffect } from "react";
import { updateSettingsAction } from "@/actions/update-settings";
import { testProviderAction } from "@/actions/test-provider";

type Provider = "openrouter" | "google" | "openai" | "anthropic" | "custom" | "google-web" | "anthropic-web" | "openai-web";
type Preset = "fast" | "balanced" | "reasoning";

type ProviderConfig = {
  key?: string;
  preset?: Preset;
  model?: string;
  temperature?: string;
  maxTokens?: string;
  baseUrl?: string;
  reasoning?: string;
  connected?: boolean; // For web subscriptions
};

type SettingsJson = Partial<Record<Provider, ProviderConfig>>;

export default function SettingsClient({
  initialProvider,
  initialSettingsJson,
  initialBalance,
  presetsConfig,
  defaultPreset,
  proxyEnabled,
  proxyBaseUrl,
  proxyApiKey,
}: {
  initialProvider: string;
  initialSettingsJson: string;
  initialBalance: string;
  presetsConfig: Record<string, any>;
  defaultPreset: string;
  proxyEnabled: boolean;
  proxyBaseUrl: string;
  proxyApiKey: string;
}) {
  const [provider, setProvider] = useState<Provider>(initialProvider as Provider);
  
  const [settings, setSettings] = useState<SettingsJson>(() => {
    try {
      return JSON.parse(initialSettingsJson) || {};
    } catch {
      return {};
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "success" | "error"; message?: string }>({ status: "idle" });

  const [models, setModels] = useState<{id: string, name?: string}[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "polling" | "success" | "error">("idle");
  const [authError, setAuthError] = useState("");

  const currentConfig = settings[provider] || {};

  function updateConfig(updates: Partial<ProviderConfig>) {
    setSettings(prev => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || {}),
        ...updates
      }
    }));
  }

  const preset = (settings.openrouter?.preset as Preset) || defaultPreset;
  const model = currentConfig.model || "";
  const temperature = currentConfig.temperature || "0.7";
  const maxTokens = currentConfig.maxTokens || "8192";
  const baseUrl = currentConfig.baseUrl || "";
  const apiKey = currentConfig.key || "";
  const reasoning = currentConfig.reasoning || "";
  const connected = currentConfig.connected || false;

  const isWebProvider = provider.endsWith("-web");

  // Models fetching
  useEffect(() => {
    setModels([]); // clear on provider change
    if (provider === "custom" || provider === "openrouter") return;

    const shouldFetchWeb = isWebProvider && proxyEnabled && connected;
    const shouldFetchApi = !isWebProvider && apiKey && (provider === "openai" || provider === "anthropic" || provider === "google" ? true : baseUrl);

    if (shouldFetchWeb || shouldFetchApi) {
      fetchModels();
    }
  }, [provider, apiKey, baseUrl, isWebProvider, proxyEnabled, connected]);

  async function fetchModels() {
    setModelsLoading(true);
    try {
      let url = `/api/proxy/models?provider=${provider}`;
      if (!isWebProvider) {
        let fetchBase = baseUrl;
        if (provider === "openai" && !baseUrl) fetchBase = "https://api.openai.com/v1";
        if (provider === "anthropic" && !baseUrl) fetchBase = "https://api.anthropic.com/v1";
        if (provider === "google" && !baseUrl) fetchBase = "https://generativelanguage.googleapis.com/v1beta/openai"; // example compatibility base
        url += `&key=${encodeURIComponent(apiKey)}&baseUrl=${encodeURIComponent(fetchBase || "")}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const m = data.data || [];
        setModels(m);
        if (m.length > 0 && !currentConfig.model) {
          updateConfig({ model: m[0].id });
        }
      }
    } catch (e) {
      console.error(e);
    }
    setModelsLoading(false);
  }

  // OAuth polling logic
  const startOAuthFlow = async () => {
    setAuthStatus("loading");
    try {
      const res = await fetch(`/api/proxy/auth?provider=${provider}`);
      const data = await res.json();
      if (!res.ok) {
        setAuthStatus("error");
        setAuthError(data.error);
        return;
      }
      
      const { url, state } = data;
      // Open in new tab
      window.open(url, "_blank");
      
      // Start polling
      setAuthStatus("polling");
      pollAuthStatus(state);
    } catch (e: any) {
      setAuthStatus("error");
      setAuthError(e.message);
    }
  };

  const pollAuthStatus = async (state: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/auth-status?state=${encodeURIComponent(state)}`);
        const data = await res.json();
        
        if (data.status === "ok") {
          clearInterval(interval);
          setAuthStatus("success");
          updateConfig({ connected: true });
        } else if (data.status === "error") {
          clearInterval(interval);
          setAuthStatus("error");
          setAuthError(data.error || "Authentication failed");
        }
      } catch (e) {
        // ignore network errors during polling
      }
    }, 2000);
  };

  // Test Provider Action
  async function handleTest() {
    setTestState({ status: "loading" });
    
    let testUrl = "";
    if (provider === "openrouter") testUrl = "https://openrouter.ai/api/v1";
    else if (provider === "google") testUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    else if (provider === "openai") testUrl = "https://api.openai.com/v1";
    else if (provider === "anthropic") testUrl = "https://api.anthropic.com/v1";
    else if (isWebProvider) testUrl = proxyBaseUrl; 
    else testUrl = baseUrl || "https://openrouter.ai/api/v1";

    let testKey = currentConfig.key || "";
    if (provider === "openrouter" && settings.openrouter?.key) {
      testKey = settings.openrouter.key;
    }
    if (isWebProvider) {
       testKey = proxyApiKey; 
       testUrl = proxyBaseUrl; 
    }

    if (!testKey && !isWebProvider) {
      setTestState({ status: "error", message: "API key is missing." });
      return;
    }

    let testModel = currentConfig.model || "";
    let testTemperature = parseFloat(currentConfig.temperature || "0.7");
    let testReasoning = currentConfig.reasoning || "";

    if (provider === "openrouter") {
      const pConfig = presetsConfig[preset] || presetsConfig[defaultPreset] || {};
      testModel = pConfig.model || "deepseek/deepseek-chat";
      testTemperature = pConfig.temperature !== undefined ? pConfig.temperature : 0.7;
      testReasoning = pConfig.reasoning || "";
    }

    if (!testModel) {
      setTestState({ status: "error", message: "Model is not specified." });
      return;
    }

    const res = await testProviderAction(testUrl, testKey, {
      model: testModel,
      temperature: testTemperature,
      reasoning: testReasoning
    });
    if (res.success) {
      setTestState({ status: "success", message: res.message });
      setTimeout(() => setTestState({ status: "idle" }), 3000);
    } else {
      setTestState({ status: "error", message: res.error });
    }
  }

  async function handleSave() {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("activeProvider", provider);
    formData.append("providerSettings", JSON.stringify(settings));
    
    await updateSettingsAction(formData);
    setIsSaving(false);
  }

  async function handleDisconnectOpenRouter() {
    if (!confirm("Are you sure you want to disconnect your OpenRouter account?")) return;
    setIsSaving(true);
    
    const newSettings = { ...settings };
    if (newSettings.openrouter) {
      delete newSettings.openrouter.key;
    }
    setSettings(newSettings);
    
    const formData = new FormData();
    formData.append("activeProvider", provider);
    formData.append("providerSettings", JSON.stringify(newSettings));
    
    await updateSettingsAction(formData);
    setIsSaving(false);
  }

  async function handleDisconnectWeb() {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) return;
    updateConfig({ connected: false });
  }

  const modelInput = provider === "custom" ? (
    <input type="text" placeholder="Provider model name" value={model} onChange={(e) => updateConfig({ model: e.target.value })} />
  ) : (
    <select value={model} onChange={(e) => updateConfig({ model: e.target.value })} disabled={modelsLoading || models.length === 0}>
      {models.length === 0 ? (
        <option value={model || ""}>{model || (modelsLoading ? "Loading models..." : "No models found")}</option>
      ) : (
        models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)
      )}
    </select>
  );

  let initialProviderName = "";
  let initialProviderDesc = "";
  let initialProviderLogo = null;
  
  switch(initialProvider) {
    case "openrouter":
      initialProviderName = "OpenRouter account";
      initialProviderDesc = "Authorized account, automatic balance check, preset model profiles.";
      initialProviderLogo = <img src="/logos/openrouter.svg" alt="" />;
      break;
    case "google":
      initialProviderName = "Google";
      initialProviderDesc = "Gemini API key";
      initialProviderLogo = <img src="/logos/gemini.svg" alt="" />;
      break;
    case "openai":
      initialProviderName = "OpenAI";
      initialProviderDesc = "OpenAI API key";
      initialProviderLogo = <img src="/logos/openai.svg" alt="" />;
      break;
    case "anthropic":
      initialProviderName = "Anthropic";
      initialProviderDesc = "Claude API key";
      initialProviderLogo = <img src="/logos/claude.svg" alt="" />;
      break;
    case "custom":
      initialProviderName = "Custom API";
      initialProviderDesc = "OpenAI-compatible endpoint";
      initialProviderLogo = <img src="/logos/custom.svg" alt="" />;
      break;
    case "google-web":
      initialProviderName = "Google Web";
      initialProviderDesc = "Gemini Advanced subscription";
      initialProviderLogo = <img src="/logos/gemini.svg" alt="" />;
      break;
    case "anthropic-web":
      initialProviderName = "Anthropic Web";
      initialProviderDesc = "Claude Pro subscription";
      initialProviderLogo = <img src="/logos/claude.svg" alt="" />;
      break;
    case "openai-web":
      initialProviderName = "OpenAI Web";
      initialProviderDesc = "ChatGPT Plus subscription";
      initialProviderLogo = <img src="/logos/openai.svg" alt="" />;
      break;
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="crumb">AltSearch / Hub / Settings</p>
          <h1>Model provider</h1>
        </div>
        <div className="head-actions" style={{ alignItems: "center" }}>
          {testState.message && (
            <span style={{ color: testState.status === "error" ? "#c62828" : "#188038", fontSize: "14px", marginRight: "16px" }}>
              {testState.message}
            </span>
          )}
          <button 
            className="button" 
            type="button" 
            onClick={handleTest} 
            disabled={testState.status === "loading" || (!currentConfig.key && !isWebProvider && provider !== "openrouter") || (provider === "openrouter" && !settings.openrouter?.key)}
          >
            {testState.status === "loading" ? "Testing..." : "Test selected"}
          </button>
          <button className="button primary" type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <section className="active-summary" aria-label="Current setup">
        <div className={`provider-logo ${initialProvider.replace('-web', '')}`} aria-label={initialProviderName}>
          {initialProviderLogo}
        </div>
        <div>
          <span className="label">Current provider</span>
          <h2>{initialProviderName}</h2>
          <p>{initialProviderDesc}</p>
        </div>
        <div className="summary-side">
          <span className="pill success">Active</span>
          {initialProvider === "openrouter" && settings.openrouter?.key && <b>{initialBalance}</b>}
        </div>
      </section>

      <div className="setup-card recommended">
        <div className="setup-head">
          <label className="recommended-choice">
            <input 
              type="radio" 
              name="provider" 
              checked={provider === "openrouter"}
              onChange={() => setProvider("openrouter")}
            />
            <span className="provider-logo openrouter">
              <img src="/logos/openrouter.svg" alt="" />
            </span>
            <span>
              <span className="recommended-label">Recommended</span>
              <b>OpenRouter account</b>
              <small>Authorize once, see balance in AltSearch, then choose a preset. No API key required.</small>
            </span>
          </label>
          <div className="setup-actions">
            {settings.openrouter?.key ? (
              <>
                <span className="pill success">Authorized</span>
                <span className="balance">{initialBalance}</span>
                <button type="button" className="button" onClick={handleDisconnectOpenRouter} disabled={isSaving}>
                  {isSaving ? "Disconnecting..." : "Disconnect"}
                </button>
              </>
            ) : (
              <>
                <span className="pill">Not connected</span>
                <a href="/api/auth/openrouter/login" className="button primary">Connect account</a>
              </>
            )}
          </div>
        </div>

        {!settings.openrouter?.key && (
          <div style={{ padding: "0 18px 18px" }}>
            <p style={{ color: "#5f6368" }}>Connect your OpenRouter account to use presets.</p>
          </div>
        )}

        <div className="preset-section" style={{ display: provider === "openrouter" && settings.openrouter?.key ? "block" : "none" }}>
          <div className="section-row-head">
            <h3>Preset</h3>
            <p>Generation profile used by OpenRouter.</p>
          </div>
          <div className="preset-row">
            {Object.entries(presetsConfig).map(([key, pConfig]) => (
              <label key={key} className={`preset-card ${preset === key ? "active" : ""}`}>
                <input 
                  type="radio" 
                  name="preset-alt" 
                  checked={preset === key} 
                  onChange={() => setSettings(p => ({ ...p, openrouter: { ...p.openrouter, preset: key as Preset }}))} 
                />
                <span>
                  <b>{pConfig.label}</b>
                  <small>{pConfig.model}</small>
                  <em>{pConfig.description}</em>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="other-methods">
        <div className="method-tabs">
          <button type="button" className={!isWebProvider && provider !== "openrouter" ? "active" : ""} onClick={() => setProvider("google")}>API keys</button>
          <button type="button" className={isWebProvider ? "active" : ""} onClick={() => setProvider("google-web")}>Subscriptions</button>
        </div>

        <div className="method-body">
          {!isWebProvider && provider !== "openrouter" && (
            <div className="manual-grid">
              <section className="method-list">
                <div className="method-section-head">
                  <h3>Choose API provider</h3>
                </div>
                <div className="provider-list">
                  <label className="provider-row">
                    <input type="radio" name="provider" checked={provider === "google"} onChange={() => setProvider("google")} />
                    <span className="provider-logo google" aria-label="Google Gemini"><img src="/logos/gemini.svg" alt="" /></span>
                    <span><b>Google</b><small>Gemini API key</small></span>
                  </label>
                  <label className="provider-row">
                    <input type="radio" name="provider" checked={provider === "openai"} onChange={() => setProvider("openai")} />
                    <span className="provider-logo openai" aria-label="OpenAI"><img src="/logos/openai.svg" alt="" /></span>
                    <span><b>OpenAI</b><small>OpenAI API key</small></span>
                  </label>
                  <label className="provider-row">
                    <input type="radio" name="provider" checked={provider === "anthropic"} onChange={() => setProvider("anthropic")} />
                    <span className="provider-logo claude" aria-label="Claude"><img src="/logos/claude.svg" alt="" /></span>
                    <span><b>Anthropic</b><small>Claude API key</small></span>
                  </label>
                  <label className="provider-row">
                    <input type="radio" name="provider" checked={provider === "custom"} onChange={() => setProvider("custom")} />
                    <span className="provider-logo custom" aria-label="Custom API"><img src="/logos/custom.svg" alt="" /></span>
                    <span><b>Custom</b><small>OpenAI-compatible endpoint</small></span>
                  </label>
                </div>
              </section>

              <section className="method-details">
                <div className="details-head">
                  <div>
                    <h2>API key settings</h2>
                    <p>Only needed when an API key provider is selected.</p>
                  </div>
                </div>
                <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
                  <label>API key <input type="password" placeholder="Paste provider API key" value={apiKey} onChange={(e) => updateConfig({ key: e.target.value })} /></label>
                  {provider === "custom" && (
                    <label>Base URL <input type="text" placeholder="Custom Base URL" value={baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} /></label>
                  )}
                  <label>Model {modelInput}</label>
                  <div className="two-col">
                    <label>Temperature <input type="text" value={temperature} onChange={(e) => updateConfig({ temperature: e.target.value })} /></label>
                    <label>Max tokens <input type="text" value={maxTokens} onChange={(e) => updateConfig({ maxTokens: e.target.value })} /></label>
                  </div>
                  <label>Reasoning <input type="text" placeholder="none, low, medium, high" value={reasoning} onChange={(e) => updateConfig({ reasoning: e.target.value })} /></label>
                </form>
              </section>
            </div>
          )}

          {isWebProvider && (
            <div className="subscription-mode">
              <div style={{ backgroundColor: '#fce8e6', color: '#c5221f', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5', border: '1px solid #fad2cf' }}>
                <b style={{ display: 'block', marginBottom: '4px' }}>Warning: Account Ban Risk</b>
                The provider may block access to your account for using automated tools. The developer <b>does not recommend</b> using web subscriptions for valuable or primary accounts. Use this feature only if you clearly understand the risks involved.
              </div>
              
              <div className="mode-explainer">
                <div className={`mode-card ${!proxyEnabled ? "active" : ""}`}>
                  <span className="mode-kicker">Current server mode</span>
                  <b>API-only mode</b>
                  <p>This server does not store user account tokens. Subscription providers are unavailable here.</p>
                </div>
                <div className={`mode-card ${proxyEnabled ? "active" : ""}`}>
                  <span className="mode-kicker">Optional local mode</span>
                  <b>Self-hosted local server</b>
                  <p>Run AltSearch locally with subscription support if you want to use your own web accounts.</p>
                </div>
              </div>

              <div className="manual-grid subscription-grid">
                <section className="method-list">
                  <div className="method-section-head">
                    <h3>Choose subscription provider</h3>
                  </div>
                  <div className="provider-list">
                    <label className={`provider-row ${!proxyEnabled ? "disabled" : ""}`}>
                      <input type="radio" name="provider" disabled={!proxyEnabled} checked={provider === "google-web"} onChange={() => setProvider("google-web")} />
                      <span className="provider-logo google" aria-label="Google Gemini"><img src="/logos/gemini.svg" alt="" /></span>
                      <span><b>Google Web</b><small>Gemini Advanced subscription</small></span>
                      {settings["google-web"]?.connected && <span className="pill success row-pill">Connected</span>}
                    </label>
                    <label className={`provider-row ${!proxyEnabled ? "disabled" : ""}`}>
                      <input type="radio" name="provider" disabled={!proxyEnabled} checked={provider === "anthropic-web"} onChange={() => setProvider("anthropic-web")} />
                      <span className="provider-logo claude" aria-label="Claude"><img src="/logos/claude.svg" alt="" /></span>
                      <span><b>Anthropic Web</b><small>Claude Pro subscription</small></span>
                      {settings["anthropic-web"]?.connected && <span className="pill success row-pill">Connected</span>}
                    </label>
                    <label className={`provider-row ${!proxyEnabled ? "disabled" : ""}`}>
                      <input type="radio" name="provider" disabled={!proxyEnabled} checked={provider === "openai-web"} onChange={() => setProvider("openai-web")} />
                      <span className="provider-logo openai" aria-label="OpenAI"><img src="/logos/openai.svg" alt="" /></span>
                      <span><b>OpenAI Web</b><small>ChatGPT Plus subscription</small></span>
                      {settings["openai-web"]?.connected && <span className="pill success row-pill">Connected</span>}
                    </label>
                  </div>
                </section>

                <section className={`method-details subscription-details ${!proxyEnabled ? "disabled" : ""}`} style={{ opacity: proxyEnabled ? 1 : 0.5 }}>
                  <div className="details-head">
                    <div>
                      <h2>Subscription settings</h2>
                      <p>Available when this app runs on your self-hosted local server.</p>
                    </div>
                    {!proxyEnabled && <span className="pill warning">Local server required</span>}
                  </div>
                  <form className="settings-form subscription-form" onSubmit={(e) => e.preventDefault()}>
                    <div className="connect-row">
                      <div>
                        <b>Provider account</b>
                        <p>Connect your web subscription account from the local server.</p>
                      </div>
                      {connected ? (
                        <button className="button" type="button" onClick={handleDisconnectWeb}>
                          Disconnect
                        </button>
                      ) : (
                      <button 
                        className="button primary" 
                        type="button" 
                        disabled={!proxyEnabled || authStatus === "loading" || authStatus === "polling"}
                        onClick={startOAuthFlow}
                      >
                        {authStatus === "polling" || authStatus === "loading" ? "Waiting..." : "Connect"}
                      </button>
                    )}
                  </div>
                    {authError && <div style={{ color: "#c62828", fontSize: "12px", marginTop: "-8px" }}>{authError}</div>}
                    <label>Model / mode {modelInput}</label>
                    <div className="two-col">
                      <label>Temperature <input type="text" value={temperature} onChange={(e) => updateConfig({ temperature: e.target.value })} disabled={!proxyEnabled} /></label>
                      <label>Max tokens <input type="text" value={maxTokens} onChange={(e) => updateConfig({ maxTokens: e.target.value })} disabled={!proxyEnabled} /></label>
                    </div>
                    <label>Reasoning <input type="text" placeholder="none, low, medium, high" value={reasoning} onChange={(e) => updateConfig({ reasoning: e.target.value })} disabled={!proxyEnabled} /></label>
                  </form>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
