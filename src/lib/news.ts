import { readEventFile } from "./event-files";

export type NewsArticle = {
  article_key: string;
  section: string;
  title: string;
  author: string;
  published: string;
  dateline: string;
  summary: string;
  visual: string;
  read_time: string;
  body: string;
};

export type NewsCorpus = {
  outlet: string;
  tagline: string;
  title: string;
  description: string;
  articles: NewsArticle[];
};

function field(block: string, name: string) {
  const match = block.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function section(block: string, name: string) {
  const start = block.match(new RegExp(`^${name}:\\s*$`, "im"));
  if (!start || start.index === undefined) return "";
  const contentStart = start.index + start[0].length;
  return block.slice(contentStart).trim();
}

function parseCorpus(content: string): NewsCorpus {
  const articleRegex = /^--- ARTICLE\s+([A-Za-z0-9_-]+)\s+---\s*$/gm;
  const matches = [...content.matchAll(articleRegex)];
  const header = matches[0]?.index !== undefined ? content.slice(0, matches[0].index) : content;

  const articles = matches.map((match, index): NewsArticle => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const block = content.slice(start, end).trim();
    const articleKey = match[1].trim();

    return {
      article_key: articleKey,
      section: field(block, "Section") || "World",
      title: field(block, "Title") || `News article ${articleKey}`,
      author: field(block, "Author") || "Staff reporter",
      published: field(block, "Published") || "unknown date",
      dateline: field(block, "Dateline") || "NEWSROOM",
      summary: field(block, "Summary"),
      visual: field(block, "Visual") || "document",
      read_time: field(block, "ReadTime") || "3 min read",
      body: section(block, "Body"),
    };
  });

  return {
    outlet: field(header, "Outlet") || "The Clarion",
    tagline: field(header, "Tagline") || "Trusted independent journalism since 1961",
    title: field(header, "Title") || "News coverage",
    description: field(header, "Description"),
    articles,
  };
}

function publishedTime(article: NewsArticle) {
  const parsed = Date.parse(article.published);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function sortArticlesByPublished(articles: NewsArticle[]) {
  return articles
    .map((article, index) => ({ article, index, time: publishedTime(article) }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.time);
      const rightValid = Number.isFinite(right.time);
      if (leftValid && rightValid && left.time !== right.time) return left.time - right.time;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      return left.index - right.index;
    })
    .map((item) => item.article);
}

export function getNewsCorpusFromFile(eventId: string) {
  const content = readEventFile(eventId, "sites/news.md");
  if (!content.trim()) return null;
  return parseCorpus(content);
}

export async function getNewsArticle(eventId: string, articleKey: string) {
  const corpus = getNewsCorpusFromFile(eventId);
  if (!corpus) return null;
  const articles = sortArticlesByPublished(corpus.articles);
  const article = articles.find((item) => item.article_key === articleKey);
  if (!article) return null;
  return { corpus, article, articles };
}
