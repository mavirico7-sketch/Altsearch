import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getSiteFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";
import { getNewsCorpusFromFile, NewsArticle, sortArticlesByPublished } from "@/lib/news";

export const dynamic = "force-dynamic";

const markets = [
  ["S&P 500", "5,312.4", "+0.42%", "up"],
  ["Nasdaq", "18,840.2", "-0.18%", "down"],
  ["Dow", "39,104.0", "+0.31%", "up"],
  ["USD/EUR", "0.924", "-0.06%", "down"],
  ["WTI Oil", "$78.45", "+0.87%", "up"],
  ["Gold", "$2,341", "-0.22%", "down"],
  ["10Y Treasury", "4.38%", "+2bp", "up"],
];

const briefs = [
  ["Business", "Markets edge higher as investors await central bank remarks", "1 hr ago · By Marcus Webb"],
  ["Politics", "Committee chair says oversight vote will proceed before recess", "2 hrs ago · By Claire Osei"],
  ["Science", "Independent lab expands review of archived public health samples", "3 hrs ago · By Tom Rigby"],
  ["Economy", "New jobless claims dip to 198,000, Labor Dept. says", "5 hrs ago · By David Cho"],
];

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
      {(type === "building" || !["chart", "world", "alert", "photo", "document"].includes(type)) && (
        <>
          <rect x="13" y="24" width="38" height="28" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M10 24 L32 11 L54 24" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M20 30 H44 M20 38 H44 M20 46 H44" stroke="currentColor" strokeWidth="3" />
        </>
      )}
      {type === "document" && (
        <>
          <path d="M18 10 H39 L50 21 V54 H18 Z" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M39 10 V22 H50 M25 31 H43 M25 39 H43 M25 47 H36" stroke="currentColor" strokeWidth="3" />
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
          <a href="#" className="act">Home</a>
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

function storyHref(eventId: string, article: NewsArticle) {
  return `/news/${eventId}/article/${article.article_key}`;
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "The Clarion");
  const corpus = getNewsCorpusFromFile(event.id);
  if (!site || site.status !== "complete" || !corpus || corpus.articles.length === 0) notFound();

  const articles = sortArticlesByPublished(corpus.articles);
  const hero = articles[articles.length - 1];
  const topStories = articles.slice(0, -1);

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="rtr">
        <Header eventId={event.id} outlet={corpus.outlet} tagline={corpus.tagline} />

        <div className="rtr-markets">
          <span className="rtr-markets-label">Markets</span>
          {markets.map(([name, value, change, direction]) => (
            <div className="mkt-item" key={name}>
              <span className="mkt-name">{name}</span>
              <span className="mkt-val">{value}</span>
              <span className={direction === "up" ? "mkt-up" : "mkt-dn"}>{change}</span>
            </div>
          ))}
        </div>

        <main className="rtr-body">
          <div className="rtr-left">
            <section className="rtr-hero">
              <div className="rtr-hero-text">
                <div className="cat-tag">{hero.section}</div>
                <h2><a href={storyHref(event.id, hero)}>{hero.title}</a></h2>
                {hero.summary && <p>{hero.summary}</p>}
                <div className="rtr-hero-byline">
                  By <span>{hero.author}</span> · {hero.dateline} · <span>{hero.published}</span>
                </div>
              </div>
              <a className="rtr-hero-img" href={storyHref(event.id, hero)}>
                <NewsVisual type={hero.visual} />
              </a>
            </section>

            {topStories.length > 0 && <div className="rtr-divider">Top stories</div>}

            <section className="news-row">
              {topStories.map((story) => (
                <article className="news-item" key={story.article_key}>
                  <a className="news-item-img" href={storyHref(event.id, story)}><NewsVisual type={story.visual} /></a>
                  <div className="cat-tag">{story.section}</div>
                  <h3><a href={storyHref(event.id, story)}>{story.title}</a></h3>
                  {story.summary && <p>{story.summary}</p>}
                  <div className="ntime">{story.published} · {story.read_time}</div>
                </article>
              ))}
            </section>

            <div className="rtr-divider">Latest</div>

            <section className="brief-list">
              {briefs.map(([tag, title, time], index) => (
                <article className="brief-item" key={title}>
                  <span className="brief-num">{index + 1}</span>
                  <div className="brief-content">
                    <div className="brief-tag">{tag}</div>
                    <div className="brief-title"><a href="#">{title}</a></div>
                    <div className="brief-time">{time}</div>
                  </div>
                </article>
              ))}
            </section>
          </div>

          <aside className="rtr-right">
            <section className="sidebar-block">
              <div className="sidebar-label">Timeline</div>
              {articles.map((article) => (
                <article className="sidebar-story" key={article.article_key}>
                  <h4><a href={storyHref(event.id, article)}>{article.title}</a></h4>
                  <div className="ntime">{article.published}</div>
                </article>
              ))}
            </section>

            <section className="sidebar-block">
              <div className="sidebar-label">Newsletters</div>
              <p className="newsletter-copy">
                Get the Morning Brief in your inbox: key stories, market moves, and what to watch today.
              </p>
              <form className="newsletter-form" action={`/news/${event.id}`}>
                <input type="email" placeholder="your@email.com" />
                <button type="submit">Sign up</button>
              </form>
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
