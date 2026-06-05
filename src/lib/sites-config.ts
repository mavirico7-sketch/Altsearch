export type SiteConfig = {
  name: string;
  tags: string[];
  description: string;
  templatePath: string;
  contentPath: string;
  urlAndSnippetRules: string;
  routeBase: string;
};

export const SITES: SiteConfig[] = [
  {
    name: "Wikipedia",
    tags: ["wiki", "encyclopedia"],
    description: "A neutral encyclopedic summary of the event.",
    templatePath: "src/templates/wikipedia.md",
    contentPath: "sites/wikipedia.html",
    urlAndSnippetRules: "URL must be in the format 'https://en.wikipedia.org/wiki/Page_Title_With_Underscores'. Snippet should be a neutral, objective 1-2 sentence encyclopedic summary.",
    routeBase: "/wikipedia",
  },
  {
    name: "Reddit",
    tags: ["forum", "discussion"],
    description: "Reddit-style anonymous discussions and rumors.",
    templatePath: "src/templates/reddit.md",
    contentPath: "sites/reddit.md",
    urlAndSnippetRules: "URL must be in the format 'https://www.reddit.com/r/SubredditName/comments/xyz123/post_title'. Snippet should be a brief, informal, or opinionated excerpt from the discussion.",
    routeBase: "/reddit",
  },
  {
    name: "YouTube",
    tags: ["video", "vlog"],
    description: "Video hosting platform with descriptions and comments.",
    templatePath: "src/templates/youtube.md",
    contentPath: "sites/youtube.md",
    urlAndSnippetRules: "URL must be in the format 'https://www.youtube.com/watch?v=xyz123'. Snippet should include the video title and a short descriptive summary, as it would appear in search results.",
    routeBase: "/youtube",
  },
  {
    name: "The Clarion",
    tags: ["news", "article"],
    description: "Mainstream independent journalism and news articles.",
    templatePath: "src/templates/news.md",
    contentPath: "sites/news.md",
    urlAndSnippetRules: "URL must be in the format 'https://www.theclarion.com/news/YYYY/MM/DD/article-slug'. Snippet should be a professional journalistic lede (first sentence) summarizing the breaking news.",
    routeBase: "/news",
  },
  {
    name: "Anonboard",
    tags: ["imageboard", "chan", "anonymous"],
    description: "Anonymous imageboard with short, fragmented, and noisy threads.",
    templatePath: "src/templates/chan.md",
    contentPath: "sites/chan.md",
    urlAndSnippetRules: "URL must be in the format 'https://anonboard.org/pol/res/123456.html'. Snippet should be a short, chaotic, slang-filled excerpt from the top of the thread.",
    routeBase: "/chan",
  },
];

export function getSiteByName(name: string): SiteConfig | undefined {
  return SITES.find((s) => s.name === name);
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  SITES.forEach((site) => site.tags.forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort();
}

export function getSiteUrl(eventId: string, siteName: string) {
  const config = getSiteByName(siteName);
  if (!config) return `/wikipedia/${eventId}`;
  return `${config.routeBase}/${eventId}`;
}
