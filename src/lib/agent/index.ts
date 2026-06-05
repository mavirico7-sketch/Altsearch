import { getConfig } from "../config";
import { getEventById } from "../events";
import { getConsoleMessages, addMessage, setRunStatus, compactHistory, heartbeatRun } from "../console";
import { systemPrompt } from "./prompt";
import { tools, executeTool, type ToolCall } from "./tools";

export interface BaseChatMessage {
  role: string;
}

export interface SystemMessage extends BaseChatMessage {
  role: "system";
  content: string;
}

export interface HumanMessage extends BaseChatMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage extends BaseChatMessage {
  role: "assistant";
  content?: string;
  tool_calls?: ToolCall[];
}

export interface ToolMessage extends BaseChatMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export type ChatMessage = SystemMessage | HumanMessage | AssistantMessage | ToolMessage;

async function chatMessages(eventId: string, eventTitle: string): Promise<ChatMessage[]> {
  const allMessages = await getConsoleMessages(eventId);
  const summaries = allMessages.filter((message) => message.role === "summary").slice(-2);
  const recent = allMessages.filter((message) => message.role !== "summary").slice(-30);
  return [
    { role: "system", content: systemPrompt(eventTitle) } as SystemMessage,
    ...summaries.map((message): AssistantMessage => ({
      role: "assistant",
      content: `summary: ${message.content}`,
    })),
    ...recent
      .map((message): ChatMessage => {
        if (message.role === "user") {
          return { role: "user", content: `user: ${message.content}` } as HumanMessage;
        }
        return { role: "assistant", content: `assistant: ${message.content}` } as AssistantMessage;
      }),
  ];
}

async function callModel(
  messages: ChatMessage[],
  llmConfig: { model: string; baseUrl: string; apiKey: string; temperature: number; maxTokens: number; reasoning?: string | number | boolean },
  signal?: AbortSignal,
  onChunk?: (text: string) => void
): Promise<AssistantMessage> {
  const body: Record<string, unknown> = {
    model: llmConfig.model,
    messages,
    tools: tools(),
    tool_choice: "auto",
    temperature: llmConfig.temperature,
    max_tokens: llmConfig.maxTokens,
    stream: true,
  };

  if (llmConfig.reasoning !== undefined) {
    body.reasoning_effort = llmConfig.reasoning;
  }

  const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Model request failed with HTTP ${response.status}: ${errorText}`);
  }
  
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let role = "assistant";
  let content = "";
  const toolCalls: any[] = [];
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") continue;
      
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        
        if (delta.role) role = delta.role;
        if (delta.content) {
          content += delta.content;
          if (onChunk) onChunk(delta.content);
        }
        
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;
            if (!toolCalls[index]) {
              const nameStr = tc.function?.name || "";
              const argsStr = tc.function?.arguments || "";
              toolCalls[index] = {
                id: tc.id,
                type: tc.type || "function",
                function: { name: nameStr, arguments: argsStr }
              };
              if (onChunk) {
                if (nameStr) onChunk(nameStr);
                if (argsStr) onChunk(argsStr);
              }
            } else {
              if (tc.function?.name) {
                toolCalls[index].function.name += tc.function.name;
                if (onChunk) onChunk(tc.function.name);
              }
              if (tc.function?.arguments) {
                toolCalls[index].function.arguments += tc.function.arguments;
                if (onChunk) onChunk(tc.function.arguments);
              }
            }
          }
        }
      } catch (e) {
        // ignore parse errors for partial JSON
      }
    }
  }

  return {
    role: "assistant",
    content: content || undefined,
    tool_calls: toolCalls.length > 0 ? toolCalls.filter(Boolean) : undefined,
  };
}

const HISTORY_STRING_LIMIT = 20000;
const HISTORY_HEAD_CHARS = 12000;
const HISTORY_TAIL_CHARS = 6000;

function truncateForHistory(value: string) {
  if (value.length <= HISTORY_STRING_LIMIT) return value;
  const omitted = value.length - HISTORY_HEAD_CHARS - HISTORY_TAIL_CHARS;
  return [
    value.slice(0, HISTORY_HEAD_CHARS),
    `[truncated ${omitted} chars]`,
    value.slice(-HISTORY_TAIL_CHARS),
  ].join("\n");
}

function normalizeForHistory(value: unknown): unknown {
  if (typeof value === "string") return truncateForHistory(value);
  if (Array.isArray(value)) return value.map(normalizeForHistory);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, normalizeForHistory(item)])
  );
}

function parseArgs(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toolCallHistory(call: ToolCall) {
  const parsedArgs = parseArgs(call.function.arguments);
  return [
    `tool_call: ${call.function.name}`,
    JSON.stringify(normalizeForHistory(parsedArgs), null, 2),
  ].join("\n");
}

function toolResultHistory(name: string, result: string) {
  return [
    `tool_result: ${name}`,
    truncateForHistory(result),
  ].join("\n");
}

import { getDb } from "../db";
import { users } from "../schema";
import { eq } from "drizzle-orm";

async function resolveLlmConfig(userId: string | null) {
  const cfg = getConfig();
  const defaultPreset = cfg.openrouter_presets?.[cfg.openrouter_default_preset];
  const defaultConfig = {
    model: defaultPreset?.model || "deepseek/deepseek-v4-pro",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    temperature: 0.7,
    maxTokens: 8192,
  };

  if (!userId) return defaultConfig;

  const db = await getDb();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user || !user.activeProvider) return defaultConfig;
  
  let settings: any = {};
  if (user.providerSettings) {
    settings = typeof user.providerSettings === "string"
      ? JSON.parse(user.providerSettings)
      : user.providerSettings;
  }

  const active = user.activeProvider;
  const config = settings[active];
  if (!config) return defaultConfig;

  if (active === "openrouter") {
    // Determine model by preset
    const presetName = config.preset || cfg.openrouter_default_preset || "balanced";
    const fallbackPreset = cfg.openrouter_default_preset || "balanced";
    const presetData = cfg.openrouter_presets?.[presetName] || cfg.openrouter_presets?.[fallbackPreset] || {
      model: "deepseek/deepseek-chat",
      temperature: 0.7,
      reasoning: undefined,
    };
    
    return {
      model: presetData.model,
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: config.key || defaultConfig.apiKey,
      temperature: presetData.temperature ?? 0.7,
      maxTokens: 8192,
      reasoning: presetData.reasoning,
    };
  }

  // Handle manual providers
  let baseUrl = "https://openrouter.ai/api/v1"; // Fallback
  let apiKey = config.key || defaultConfig.apiKey;

  if (active.endsWith("-web")) {
    baseUrl = process.env.PROXY_BASE_URL || "http://cliproxy:8317/v1";
    apiKey = process.env.PROXY_API_KEY || "1";
  } else if (active === "google") baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
  else if (active === "openai") baseUrl = "https://api.openai.com/v1";
  else if (active === "anthropic") baseUrl = "https://api.anthropic.com/v1";
  else if (active === "custom") baseUrl = config.baseUrl || baseUrl;

  return {
    model: config.model || defaultConfig.model,
    baseUrl,
    apiKey,
    temperature: parseFloat(config.temperature) || 0.7,
    maxTokens: parseInt(config.maxTokens, 10) || 8192,
  };
}

import { consoleRuns } from "../schema";
import { agentEvents, runControllers } from "./state";

export async function runConsoleAgent(eventId: string, runId: number) {
  const event = await getEventById(eventId);
  if (!event) {
    await setRunStatus(runId, "failed", "Event was not found.");
    return;
  }

  await setRunStatus(runId, "running");
  
  const controller = new AbortController();
  runControllers.set(runId, controller);
  let chunkTokens = 0;

  try {
    const llmConfig = await resolveLlmConfig(event.userId);
    const messages = await chatMessages(eventId, event.title);
    const db = await getDb();

    for (let step = 0; step < 12; step++) {
      // Check if run was externally cancelled/stopped
      const currentRun = await db.select().from(consoleRuns).where(eq(consoleRuns.id, runId)).get();
      if (currentRun?.cancelRequested) {
        controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }
      if (currentRun?.status === "failed" || currentRun?.status === "complete") {
        console.log(`Agent loop interrupted. Run status is ${currentRun.status}`);
        return;
      }
      await heartbeatRun(runId);

      const assistant = (await callModel(messages, llmConfig, controller.signal, (text) => {
        chunkTokens += Math.ceil(text.length / 4);
        agentEvents.emit("typing", { eventId, runId, tokens: chunkTokens });
      })) as AssistantMessage;
      
      agentEvents.emit("typing", { eventId, runId, tokens: null });
      
      const content = typeof assistant.content === "string" ? assistant.content.trim() : "";
      const toolCalls = assistant.tool_calls ?? [];

      messages.push(assistant);
      if (content) {
        await addMessage(eventId, "assistant", content);
        agentEvents.emit("refresh", { eventId });
      }

      if (toolCalls.length === 0) {
        if (!content) {
          await addMessage(eventId, "assistant", "Done. No changes were required.");
          agentEvents.emit("refresh", { eventId });
        }
        await setRunStatus(runId, "complete");
        await compactHistory(eventId);
        return;
      }

      for (const call of toolCalls) {
        const beforeToolRun = await db.select().from(consoleRuns).where(eq(consoleRuns.id, runId)).get();
        if (beforeToolRun?.cancelRequested) {
          controller.abort();
          throw new DOMException("Aborted", "AbortError");
        }
        const toolCallMessage = await addMessage(eventId, "tool", toolCallHistory(call));
        agentEvents.emit("refresh", { eventId });
        const output = await executeTool(eventId, call, toolCallMessage.id);
        await addMessage(eventId, "tool", toolResultHistory(call.function.name, output.result));
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: output.result,
        });
        agentEvents.emit("refresh", { eventId });
      }
    }

    await addMessage(eventId, "assistant", "Stopped after reaching the step limit. Recent changes are saved; you can continue with the next command.");
    await setRunStatus(runId, "complete");
    agentEvents.emit("refresh", { eventId });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      await addMessage(eventId, "assistant", "[Operation aborted by user]");
      await setRunStatus(runId, "failed", "Aborted");
    } else {
      const message = err instanceof Error ? err.message : String(err);
      await addMessage(eventId, "assistant", `Generation failed: ${message}`);
      await setRunStatus(runId, "failed", message);
    }
    agentEvents.emit("refresh", { eventId });
  } finally {
    runControllers.delete(runId);
  }
}
