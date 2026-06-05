import { readEventFile } from "./event-files";

export type YouTubeComment = {
  author: string;
  score: number;
  body: string;
  replies?: YouTubeComment[];
};

export type YouTubeVideo = {
  video_key: string;
  title: string;
  channel: string;
  uploaded: string;
  views: number;
  likes: number;
  duration: string;
  description: string;
  comments: YouTubeComment[];
};

export type YouTubeCorpus = {
  title: string;
  description: string;
  videos: YouTubeVideo[];
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

function parseCommentLine(line: string) {
  const match = line.match(/^(\s*)-\s+(.+?)\s+\[(-?\d+)\]:\s*(.*)$/);
  if (!match) return null;

  return {
    indent: match[1].length,
    comment: {
      author: match[2].trim(),
      score: Number(match[3]),
      body: match[4].trim(),
      replies: [],
    } satisfies YouTubeComment,
  };
}

function parseComments(content: string): YouTubeComment[] {
  const roots: YouTubeComment[] = [];
  let currentRoot: YouTubeComment | null = null;
  let currentComment: YouTubeComment | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const parsed = parseCommentLine(line);
    if (parsed) {
      if (parsed.indent >= 2 && currentRoot) {
        currentRoot.replies ??= [];
        currentRoot.replies.push(parsed.comment);
      } else {
        roots.push(parsed.comment);
        currentRoot = parsed.comment;
      }
      currentComment = parsed.comment;
      continue;
    }

    if (currentComment && /^\s+/.test(rawLine)) {
      currentComment.body = `${currentComment.body}\n${line.trim()}`.trim();
    }
  }

  return roots;
}

function parseCorpus(content: string): YouTubeCorpus {
  const videoRegex = /^--- VIDEO\s+([A-Za-z0-9_-]+)\s+---\s*$/gm;
  const matches = [...content.matchAll(videoRegex)];
  const header = matches[0]?.index !== undefined ? content.slice(0, matches[0].index) : content;

  const videos = matches.map((match, index): YouTubeVideo => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const block = content.slice(start, end).trim();
    const videoKey = match[1].trim();

    return {
      video_key: videoKey,
      title: field(block, "Title") || `YouTube video ${videoKey}`,
      channel: field(block, "Channel") || "unknown",
      uploaded: field(block, "Uploaded") || "unknown date",
      views: numberField(block, "Views"),
      likes: numberField(block, "Likes"),
      duration: field(block, "Duration") || "0:00",
      description: section(block, "Description", "Comments"),
      comments: parseComments(section(block, "Comments")),
    };
  });

  return {
    title: field(header, "Title") || "YouTube videos",
    description: field(header, "Description"),
    videos,
  };
}

export function getYouTubeCorpusFromFile(eventId: string) {
  const content = readEventFile(eventId, "sites/youtube.md");
  if (!content.trim()) return null;
  return parseCorpus(content);
}

export async function getYouTubeVideo(eventId: string, videoKey: string) {
  const corpus = getYouTubeCorpusFromFile(eventId);
  if (!corpus) return null;
  const video = corpus.videos.find((item) => item.video_key === videoKey);
  if (!video) return null;
  return { corpus, video };
}
