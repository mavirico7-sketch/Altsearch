import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getSiteFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";
import { getNewsArticle } from "@/lib/news";

export const dynamic = "force-dynamic";

function NewsVisual({ type }: { type: string }) {
  return (
    <svg className="rtr-icon" viewBox="0 0 64 64" aria-hidden="true">
      {type === "chart" && (
        <>
          <path d="M10 50 H55" stroke="currentColor" strokeWidth="3" />
          <path d="M12 45 L23 34 L32 39 L45 21 L55 28" fill="none" stroke="currentColor" strokeWidth="4" />
        </>
      )}
      {type === "world" && (
        <>
          <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M10 32 H54 M32 10 C24 20 24 44 32 54 M32 10 C40 20 40 44 32 54" fill="none" stroke="currentColor" strokeWidth="3" />
        </>
      )}
      {type === "alert" && (
        <>
          <path d="M32 10 L56 52 H8 Z" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M32 24 V38 M32 45 V48" stroke="currentColor" strokeWidth="4" />
        </>
      )}
      {type === "photo" && (
        <>
          <rect x="11" y="17" width="42" height="31" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="24" cy="28" r="5" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M14 45 L27 35 L36 41 L43 33 L52 44" fill="none" stroke="currentColor" strokeWidth="3" />
        </>
      )}
      {type === "document" && (
        <>
          <path d="M18 10 H39 L50 21 V54 H18 Z" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M39 10 V22 H50 M25 31 H43 M25 39 H43 M25 47 H36" stroke="currentColor" strokeWidth="3" />
        </>
      )}
      {(type === "building" || !["chart", "world", "alert", "photo", "document"].includes(type)) && (
        <>
          <rect x="13" y="24" width="38" height="28" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M10 24 L32 11 L54 24" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M20 30 H44 M20 38 H44 M20 46 H44" stroke="currentColor" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

function Logo({ outlet }: { outlet: string }) {
  const normalized = outlet || "The Clarion";
  const parts = normalized.split(/\s+/);
  const first = parts.slice(0, -1).join(" ") || "The";
  const last = parts.at(-1) || "Clarion";
  return <>{first}<span>{last}</span></>;
}

function Header({ eventId, outlet, tagline }: { eventId: string; outlet: string; tagline: string }) {
  return (
    <>
      <div className="rtr-topbar">
        <div className="rtr-topbar-left">
          <a href="#">Sign in</a>
          <a href="#">My account</a>
          <a href="#">Newsletters</a>
          <a href="#">Podcasts</a>
          <a href="#">Advertise</a>
          <a href="#">Contact</a>
        </div>
        <div className="rtr-topbar-right">
          <span>Thursday, May 28, 2026</span>
          <a href="#" className="rtr-sub-btn">Subscribe</a>
        </div>
      </div>
      <header className="rtr-header">
        <div className="rtr-header-inner">
          <a href={`/news/${eventId}`} className="rtr-logo"><Logo outlet={outlet} /></a>
          <div className="rtr-header-right">
            <div className="rtr-dateline">{tagline}</div>
            <form className="rtr-search" action={`/search/${eventId}`}>
              <input type="text" placeholder={`Search ${outlet}...`} />
              <button aria-label="Search" type="submit">⌕</button>
            </form>
          </div>
        </div>
        <nav className="rtr-nav">
          <a href={`/news/${eventId}`} className="act">Home</a>
          <a href="#">Politics</a>
          <a href="#">Economy</a>
          <a href="#">World</a>
          <a href="#">Business</a>
          <a href="#">Technology</a>
          <a href="#">Science</a>
          <a href="#">Health</a>
          <a href="#">Opinion</a>
          <a href="#">Investigations</a>
          <a href="#">Markets</a>
        </nav>
      </header>
    </>
  );
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ eventId: string; articleKey: string }>;
}) {
  const { eventId: eventIdStr, articleKey } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "The Clarion");
  const result = await getNewsArticle(event.id, articleKey);
  if (!site || site.status !== "complete" || !result) notFound();

  const { corpus, article, articles } = result;
  const related = articles.filter((item) => item.article_key !== article.article_key).slice(0, 6);
  const paragraphs = article.body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="rtr">
        <Header eventId={event.id} outlet={corpus.outlet} tagline={corpus.tagline} />
        <main className="rtr-article-layout">
          <article className="rtr-article">
            <div className="cat-tag">{article.section}</div>
            <h1>{article.title}</h1>
            {article.summary && <p className="rtr-article-standfirst">{article.summary}</p>}
            <div className="rtr-article-meta">
              By <span>{article.author}</span> · {article.dateline} · {article.published} · {article.read_time}
            </div>
            <div className="rtr-article-visual rtr-generated-visual">
              <NewsVisual type={article.visual} />
            </div>
            <div className="rtr-article-copy">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside className="rtr-article-side">
            <section className="sidebar-block">
              <div className="sidebar-label">Related coverage</div>
              {related.map((item) => (
                <article className="sidebar-story" key={item.article_key}>
                  <h4><a href={`/news/${event.id}/article/${item.article_key}`}>{item.title}</a></h4>
                  <div className="ntime">{item.published}</div>
                </article>
              ))}
            </section>
          </aside>
        </main>

        <footer className="rtr-footer">
          <nav className="footer-nav">
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Advertise</a>
            <a href="#">Privacy policy</a>
            <a href="#">Terms of use</a>
            <a href="#">Corrections</a>
            <a href="#">Contact the newsroom</a>
          </nav>
          <div className="footer-copy">© 2026 {corpus.outlet} Media Group, Inc. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
