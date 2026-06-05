import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { listCompleteSiteFiles } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";
import { globalResultHref } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const eventId = idStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const results = await listCompleteSiteFiles(event.id);

  return (
    <>
    <BodyClass className="search-shell-body" />
    <div className="google-page">
      <div className="google-search-bar-container">
        <form className="google-search-form" action={`/search`}>
          <input
            className="google-search-input"
            name="q"
            defaultValue={event.title}
          />
          <button className="google-search-button" type="submit">
            Search
          </button>
        </form>
      </div>

      <nav className="google-tabs" aria-label="Search types">
        <span className="selected">Web</span>
        <span>Images</span>
        <span>News</span>
        <span>Discussions</span>
      </nav>

      <main className="google-results">
        <p className="google-stats">
          About {results.length} result{results.length === 1 ? "" : "s"}
        </p>

        {results.map((result) => (
          <article key={result.id} className="google-result">
            <h2>
              <a href={globalResultHref({ eventId: event.id, siteName: result.siteName })}>
                {result.title}
              </a>
            </h2>
            <div className="google-url">{result.displayUrl}</div>
            <p>{result.snippet}</p>
            <div className="google-result-meta">
              {result.siteName}
            </div>
          </article>
        ))}
        {results.length === 0 && (
          <p className="google-empty">
            No public pages yet. Open the <a href={`/hub/events/${event.id}`}>Event Editor</a> and add a site.
          </p>
        )}
      </main>
    </div>
    </>
  );
}
