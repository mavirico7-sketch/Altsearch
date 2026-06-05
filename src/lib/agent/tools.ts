import { SITES } from "../sites-config";
import { readEventFile, writeEventFile, markSiteComplete, listEventFiles } from "../event-files";
import { getEventById, touchEvent } from "../events";
import { getDb } from "../db";
import { consoleFileChanges } from "../schema";
import fs from "fs";
import path from "path";

const EDITABLE_PATHS = new Set([
  "event-notes.md",
  ...SITES.map((s) => s.contentPath),
]);

const READABLE_PATHS = new Set([
  "event-notes.md",
  ...EDITABLE_PATHS,
  ...SITES.map((s) => s.templatePath),
]);

export function tools() {
  return [
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List editable files in this event session.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read an editable site/session file, template, or event-notes.md.",
        parameters: {
          type: "object",
          properties: { path: { type: "string", enum: [...READABLE_PATHS] } },
          required: ["path"],
          additionalProperties: false,
        },
      },
    },

    {
      type: "function",
      function: {
        name: "search_file",
        description: "Search an editable file for a plain-text query and return matching line numbers with small context.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...READABLE_PATHS] },
            query: { type: "string" },
            contextLines: { type: "number" },
            maxMatches: { type: "number" },
          },
          required: ["path", "query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_around",
        description: "Read a chunk of an editable file around a specific 1-based line number.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...READABLE_PATHS] },
            line: { type: "number" },
            beforeLines: { type: "number" },
            afterLines: { type: "number" },
          },
          required: ["path", "line"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Replace an entire editable file. Use only when creating a file or explicitly rewriting it.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...EDITABLE_PATHS] },
            content: { type: "string" },
            siteName: { type: "string" },
            title: { type: "string" },
            displayUrl: { type: "string" },
            snippet: { type: "string" },
            changeSummary: { type: "string" },
          },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "replace_in_file",
        description: "Replace exact text in an editable file.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...EDITABLE_PATHS] },
            search: { type: "string" },
            replacement: { type: "string" },
            changeSummary: { type: "string" },
          },
          required: ["path", "search", "replacement"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "insert_before",
        description: "Insert content before exact anchor text in an editable file.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...EDITABLE_PATHS] },
            anchor: { type: "string" },
            content: { type: "string" },
            changeSummary: { type: "string" },
          },
          required: ["path", "anchor", "content"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "insert_after",
        description: "Insert content after exact anchor text in an editable file.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", enum: [...EDITABLE_PATHS] },
            anchor: { type: "string" },
            content: { type: "string" },
            changeSummary: { type: "string" },
          },
          required: ["path", "anchor", "content"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_site_metadata",
        description: "Update the search engine metadata (title, snippet, url) for a site without modifying its file content.",
        parameters: {
          type: "object",
          properties: {
            siteName: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            displayUrl: { type: "string" },
            changeSummary: { type: "string" },
          },
          required: ["siteName"],
          additionalProperties: false,
        },
      },
    },
  ];
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number) {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function assertReadablePath(filePath: string) {
  if (!READABLE_PATHS.has(filePath)) throw new Error(`Cannot read path: ${filePath}`);
}

function assertEditablePath(filePath: string) {
  if (!EDITABLE_PATHS.has(filePath)) throw new Error(`Cannot edit path: ${filePath}`);
}

async function readFileContent(eventId: string, filePath: string): Promise<string> {
  if (filePath.startsWith("src/templates/")) {
    const rootPath = process.cwd();
    const fullPath = path.join(rootPath, filePath);
    if (!fs.existsSync(fullPath)) return "";
    return fs.readFileSync(fullPath, "utf-8");
  }
  return readEventFile(eventId, filePath);
}

function numberedLines(content: string) {
  return content.split(/\r?\n/).map((text, index) => ({
    line: index + 1,
    text,
  }));
}

async function searchFileTool(eventId: string, args: Record<string, unknown>) {
  const filePath = stringArg(args, "path");
  const query = stringArg(args, "query");
  const contextLines = Math.max(0, Math.min(8, Math.floor(numberArg(args, "contextLines", 2))));
  const maxMatches = Math.max(1, Math.min(50, Math.floor(numberArg(args, "maxMatches", 20))));
  assertReadablePath(filePath);
  if (!query) throw new Error("search_file requires non-empty query.");

  const content = await readFileContent(eventId, filePath);
  const lines = numberedLines(content);
  const queryLower = query.toLowerCase();
  const matchingIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter((item) => item.line.text.toLowerCase().includes(queryLower))
    .slice(0, maxMatches);

  if (matchingIndexes.length === 0) return `No matches for ${JSON.stringify(query)} in ${filePath}.`;

  const chunks = matchingIndexes.map(({ line, index }) => {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length, index + contextLines + 1);
    const body = lines.slice(start, end).map((item) => {
      const marker = item.line === line.line ? ">" : " ";
      return `${marker}${String(item.line).padStart(5, " ")}: ${item.text}`;
    }).join("\n");
    return body;
  });

  return [
    `Matches for ${JSON.stringify(query)} in ${filePath}: ${matchingIndexes.length}${matchingIndexes.length === maxMatches ? " (limited)" : ""}`,
    "",
    chunks.join("\n--\n"),
  ].join("\n");
}

async function readAroundTool(eventId: string, args: Record<string, unknown>) {
  const filePath = stringArg(args, "path");
  const requestedLine = Math.floor(numberArg(args, "line", 1));
  const beforeLines = Math.max(0, Math.min(120, Math.floor(numberArg(args, "beforeLines", 40))));
  const afterLines = Math.max(0, Math.min(240, Math.floor(numberArg(args, "afterLines", 160))));
  assertReadablePath(filePath);

  const content = await readFileContent(eventId, filePath);
  const lines = numberedLines(content);
  if (lines.length === 0) return `${filePath} is empty.`;

  const line = Math.max(1, Math.min(lines.length, requestedLine));
  const start = Math.max(0, line - beforeLines - 1);
  const end = Math.min(lines.length, line + afterLines);

  return [
    `Showing ${filePath} lines ${start + 1}-${end} of ${lines.length}. Target line: ${line}.`,
    "",
    lines.slice(start, end).map((item) => {
      const marker = item.line === line ? ">" : " ";
      return `${marker}${String(item.line).padStart(5, " ")}: ${item.text}`;
    }).join("\n"),
  ].join("\n");
}

async function writeFileTool(
  eventId: string,
  args: Record<string, unknown>,
  changeMessageId: number,
) {
  const filePath = stringArg(args, "path");
  const content = stringArg(args, "content");
  assertEditablePath(filePath);

  const previousContent = readEventFile(eventId, filePath);
  writeEventFile(eventId, filePath, content);
  await touchEvent(eventId);

  const db = await getDb();
  await db.insert(consoleFileChanges).values({
    messageId: changeMessageId,
    eventId,
    path: filePath,
    previousContent,
    newContent: content,
  }).run();

  const siteName = stringArg(args, "siteName");
  if (siteName && filePath !== "event-notes.md" && content.trim()) {
    await markSiteComplete({
      eventId,
      siteName,
      path: filePath,
      title: stringArg(args, "title") || undefined,
      displayUrl: stringArg(args, "displayUrl") || undefined,
      snippet: stringArg(args, "snippet") || undefined,
    });
  }

  return `Wrote ${filePath} (${content.length} chars).`;
}

async function replaceInFileTool(eventId: string, args: Record<string, unknown>, changeMessageId: number) {
  const filePath = stringArg(args, "path");
  const search = stringArg(args, "search");
  const replacement = stringArg(args, "replacement");
  assertEditablePath(filePath);
  if (!search) throw new Error("replace_in_file requires non-empty search.");

  const previousContent = readEventFile(eventId, filePath);
  if (!previousContent.includes(search)) {
    throw new Error(`Search text was not found in ${filePath}.`);
  }
  const newContent = previousContent.replace(search, replacement);
  return writeFileTool(eventId, { ...args, path: filePath, content: newContent }, changeMessageId);
}

async function insertTool(
  eventId: string,
  args: Record<string, unknown>,
  mode: "before" | "after",
  changeMessageId: number,
) {
  const filePath = stringArg(args, "path");
  const anchor = stringArg(args, "anchor");
  const content = stringArg(args, "content");
  assertEditablePath(filePath);
  if (!anchor) throw new Error(`insert_${mode} requires non-empty anchor.`);

  const previousContent = readEventFile(eventId, filePath);
  const index = previousContent.indexOf(anchor);
  if (index === -1) throw new Error(`Anchor was not found in ${filePath}.`);
  const insertAt = mode === "before" ? index : index + anchor.length;
  const newContent = `${previousContent.slice(0, insertAt)}${content}${previousContent.slice(insertAt)}`;
  return writeFileTool(eventId, { ...args, path: filePath, content: newContent }, changeMessageId);
}

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function parseArgs(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function executeTool(eventId: string, call: ToolCall, historyMessageId: number) {
  const args = parseArgs(call.function.arguments);
  const name = call.function.name;

  try {
    if (name === "list_files") {
      return { visible: "list_files", result: JSON.stringify(listEventFiles(eventId), null, 2) };
    }

    if (name === "read_file") {
      const filePath = stringArg(args, "path");
      assertReadablePath(filePath);
      return { visible: `read_file: ${filePath}`, result: await readFileContent(eventId, filePath) || "(empty file)" };
    }


    if (name === "search_file") {
      return { visible: `search_file: ${stringArg(args, "path")} ("${stringArg(args, "query")}")`, result: await searchFileTool(eventId, args) };
    }

    if (name === "read_around") {
      return { visible: `read_around: ${stringArg(args, "path")} (line ${numberArg(args, "line", 1)})`, result: await readAroundTool(eventId, args) };
    }

    if (name === "write_file") {
      return { visible: `write_file: ${stringArg(args, "path")}`, result: await writeFileTool(eventId, args, historyMessageId) };
    }

    if (name === "replace_in_file") {
      return { visible: `replace_in_file: ${stringArg(args, "path")} ("${stringArg(args, "search")}")`, result: await replaceInFileTool(eventId, args, historyMessageId) };
    }

    if (name === "insert_before") {
      return { visible: `insert_before: ${stringArg(args, "path")} ("${stringArg(args, "anchor")}")`, result: await insertTool(eventId, args, "before", historyMessageId) };
    }

    if (name === "insert_after") {
      return { visible: `insert_after: ${stringArg(args, "path")} ("${stringArg(args, "anchor")}")`, result: await insertTool(eventId, args, "after", historyMessageId) };
    }

    if (name === "update_site_metadata") {
      const siteName = stringArg(args, "siteName");
      if (!siteName) throw new Error("update_site_metadata requires non-empty siteName.");
      
      const updateData: any = { eventId, siteName };
      const title = stringArg(args, "title");
      if (title) updateData.title = title;
      const snippet = stringArg(args, "snippet");
      if (snippet) updateData.snippet = snippet;
      const displayUrl = stringArg(args, "displayUrl");
      if (displayUrl) updateData.displayUrl = displayUrl;

      await markSiteComplete(updateData);
      return { visible: `update_site_metadata: ${siteName}`, result: `Updated metadata for ${siteName}.` };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { visible: `${name} failed`, result: `ERROR: ${message}` };
  }
}
