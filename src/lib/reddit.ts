import { readEventFile } from "./event-files";

export type RedditComment = {
  author: string;
  score: number;
  body: string;
  replies?: RedditComment[];
};

export type RedditPost = {
  post_key: string;
  subreddit: string;
  title: string;
  author: string;
  posted_at: string;
  score: number;
  comment_count: number;
  body: string;
  comments: RedditComment[];
};

export type RedditCorpus = {
  title: string;
  description: string;
  posts: RedditPost[];
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
    } satisfies RedditComment,
  };
}

function parseComments(content: string): RedditComment[] {
  const roots: RedditComment[] = [];
  let currentRoot: RedditComment | null = null;
  let currentComment: RedditComment | null = null;

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

function countComments(comments: RedditComment[]): number {
  return comments.reduce((sum, comment) => (
    sum + 1 + countComments(comment.replies ?? [])
  ), 0);
}

function parseCorpus(content: string): RedditCorpus {
  const postRegex = /^--- POST\s+([A-Za-z0-9_-]+)\s+---\s*$/gm;
  const matches = [...content.matchAll(postRegex)];
  const header = matches[0]?.index !== undefined ? content.slice(0, matches[0].index) : content;

  const posts = matches.map((match, index): RedditPost => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const block = content.slice(start, end).trim();
    const comments = parseComments(section(block, "Comments"));
    const declaredCommentCount = numberField(block, "Comments");
    const postKey = match[1].trim();

    return {
      post_key: postKey,
      subreddit: field(block, "Subreddit") || "worldnews",
      title: field(block, "Title") || `Reddit post ${postKey}`,
      author: field(block, "Author") || "deleted",
      posted_at: field(block, "Posted") || "unknown date",
      score: numberField(block, "Score"),
      comment_count: declaredCommentCount || countComments(comments),
      body: section(block, "Body", "Comments"),
      comments,
    };
  });

  return {
    title: field(header, "Title") || "Reddit discussions",
    description: field(header, "Description"),
    posts,
  };
}

export function getRedditCorpusFromFile(eventId: string) {
  const content = readEventFile(eventId, "sites/reddit.md");
  if (!content.trim()) return null;
  return parseCorpus(content);
}

export async function getRedditPost(eventId: string, postKey: string) {
  const corpus = getRedditCorpusFromFile(eventId);
  if (!corpus) return null;
  const post = corpus.posts.find((item) => item.post_key === postKey);
  if (!post) return null;
  return { corpus, post };
}
