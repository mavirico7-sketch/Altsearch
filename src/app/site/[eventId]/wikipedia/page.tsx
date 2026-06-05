import { notFound } from "next/navigation";
import { getSiteFile, readEventFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";

export const dynamic = "force-dynamic";

function sanitizeArticleHtml(raw: string) {
  let html = raw
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, "href=\"#\"")
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "href=\"#\"");

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1];

  html = html
    .replace(/<\/?(?:html|head|body)[^>]*>/gi, "")
    .replace(/<div[^>]+id=["']header["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]+id=["']page-tabs["'][^>]*>[\s\S]*?<\/div>/gi, "");

  const contentStart = html.match(/<div[^>]+id=["']content["'][^>]*>/i);
  if (contentStart?.index !== undefined) {
    html = html.slice(contentStart.index + contentStart[0].length);
    html = html.replace(/<\/div>\s*$/i, "");
  }

  return html.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function articleHtml(content: string, fallbackTitle: string) {
  const html = sanitizeArticleHtml(content);
  if (/<h1\b[^>]*id=["']firstHeading["'][^>]*>/i.test(html)) return html;
  return `<h1 id="firstHeading" class="firstHeading">${escapeHtml(fallbackTitle)}</h1>${html}`;
}

export default async function EventWikipediaPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  await requireEventViewerPage(eventId);
  const site = await getSiteFile(eventId, "Wikipedia");
  if (!site || site.status !== "complete") notFound();

  const content = readEventFile(eventId, site.path);

  return (
    <div className="wiki-page-wrapper">
      <div id="mw-page-base" className="noprint"></div>
      <div id="mw-head-base" className="noprint"></div>
      
      <div id="mw-navigation">
        <div id="mw-head">
          <div id="p-personal">
            <ul>
              <li><a href="#">Not logged in</a></li>
              <li><a href="#">Talk</a></li>
              <li><a href="#">Contributions</a></li>
              <li><a href="#">Create account</a></li>
              <li><a href="#">Log in</a></li>
            </ul>
          </div>
          <div id="left-navigation" className="vectorTabs">
            <ul>
              <li className="selected"><span>Article</span></li>
              <li><a href="#">Talk</a></li>
            </ul>
          </div>
          <div id="right-navigation">
            <div id="p-views" className="vectorTabs">
              <ul>
                <li className="selected"><span>Read</span></li>
                <li><a href="#">Edit</a></li>
                <li><a href="#">View history</a></li>
              </ul>
            </div>
            <div id="p-search">
              <form action="#">
                <div id="simpleSearch">
                  <input type="search" placeholder="Search Wikipedia" />
                  <button type="button">🔍</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        <div id="mw-panel">
          <div id="p-logo">
            <a href="#">
              <div className="logo-text">WIKIPEDIA</div>
              <div className="logo-subtext">The Free Encyclopedia</div>
            </a>
          </div>
          <div className="portal">
            <h3 className="portal-title">Navigation</h3>
            <div className="portal-body">
              <ul>
                <li><a href="#">Main page</a></li>
                <li><a href="#">Contents</a></li>
                <li><a href="#">Current events</a></li>
                <li><a href="#">Random article</a></li>
                <li><a href="#">About Wikipedia</a></li>
                <li><a href="#">Contact us</a></li>
                <li><a href="#">Donate</a></li>
              </ul>
            </div>
          </div>
          <div className="portal">
            <h3 className="portal-title">Contribute</h3>
            <div className="portal-body">
              <ul>
                <li><a href="#">Help</a></li>
                <li><a href="#">Learn to edit</a></li>
                <li><a href="#">Community portal</a></li>
                <li><a href="#">Recent changes</a></li>
                <li><a href="#">Upload file</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div id="content" className="mw-body" role="main">
        <div id="bodyContent">
          {content ? (
            <div
              className="wiki-html-fragment"
              dangerouslySetInnerHTML={{
                __html: articleHtml(content, site.title.replace(/\s+-\s+Wikipedia$/i, "")),
              }}
            />
          ) : (
            <p>This article has no content yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
