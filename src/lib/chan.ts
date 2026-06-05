import { readEventFile } from "./event-files";

export type ChanReply = {
  post_no: string;
  posted_at: string;
  body: string;
};

export type ChanThread = {
  thread_key: string;
  board: string;
  subject: string;
  posted_at: string;
  post_no: string;
  replies_count: number;
  images_count: number;
  image: string;
  op_body: string;
  replies: ChanReply[];
};

export type ChanCorpus = {
  board: string;
  title: string;
  description: string;
  threads: ChanThread[];
};

function field(block: string, name: string) {
  const match = block.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function numberField(block: string, name: string) {
  const raw = field(block, name);
  const parsed = Number(raw.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function section(block: string, name: string, until?: string) {
  const start = block.match(new RegExp(`^${name}:\\s*$`, "im"));
  if (!start || start.index === undefined) return "";

  const contentStart = start.index + start[0].length;
  const rest = block.slice(contentStart);
  if (!until) return rest.trim();

  const end = rest.match(new RegExp(`^${until}:\\s*$`, "im"));
  return (end && end.index !== undefined ? rest.slice(0, end.index) : rest).trim();
}

function cleanOp(content: string) {
  return content.replace(/^Anonymous:\s*/im, "").trim();
}

function parseReplies(content: string): ChanReply[] {
  const replyRegex = /^@([A-Za-z0-9_-]+)\s+(.+?)\s*$/gm;
  const matches = [...content.matchAll(replyRegex)];
  if (matches.length === 0) return parseLegacyReplies(content);

  return matches.map((match, index): ChanReply => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    return {
      post_no: match[1].trim(),
      posted_at: match[2].trim(),
      body: content.slice(start, end).trim(),
    };
  });
}

function parseLegacyReplies(content: string): ChanReply[] {
  const replyRegex = /^>>([A-Za-z0-9_-]+)\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)\s*$/gm;
  const matches = [...content.matchAll(replyRegex)];

  return matches.map((match, index): ChanReply => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    return {
      post_no: match[1].trim(),
      posted_at: match[2].trim(),
      body: content.slice(start, end).trim(),
    };
  });
}

function parseCorpus(content: string): ChanCorpus {
  const threadRegex = /^--- THREAD\s+([A-Za-z0-9_-]+)\s+---\s*$/gm;
  const matches = [...content.matchAll(threadRegex)];
  const header = matches[0]?.index !== undefined ? content.slice(0, matches[0].index) : content;

  const threads = matches.map((match, index): ChanThread => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const block = content.slice(start, end).trim();
    const threadKey = match[1].trim();
    const replies = parseReplies(section(block, "Replies"));

    return {
      thread_key: threadKey,
      board: field(block, "Board") || field(header, "Board") || "/x/",
      subject: field(block, "Subject") || `Imageboard thread ${threadKey}`,
      posted_at: field(block, "Posted") || "unknown date",
      post_no: field(block, "PostNo") || threadKey,
      replies_count: numberField(block, "Replies") || replies.length,
      images_count: numberField(block, "Images"),
      image: field(block, "Image") || "unavailable.jpg",
      op_body: cleanOp(section(block, "OP", "Replies")),
      replies,
    };
  });

  return {
    board: field(header, "Board") || "/x/",
    title: field(header, "Title") || "Anonymous imageboard threads",
    description: field(header, "Description"),
    threads,
  };
}

export function getChanCorpusFromFile(eventId: string) {
  const content = readEventFile(eventId, "sites/chan.md");
  if (!content.trim()) return null;
  return parseCorpus(content);
}

export async function getChanThread(eventId: string, threadKey: string) {
  const corpus = getChanCorpusFromFile(eventId);
  if (!corpus) return null;
  const thread = corpus.threads.find((item) => item.thread_key === threadKey);
  if (!thread) return null;
  return { corpus, thread };
}
