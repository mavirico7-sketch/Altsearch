import BodyClass from "@/components/BodyClass";
import { globalResultHref, globalSearch } from "@/lib/global-search";
import { SITE_NAME } from "@/lib/site";

import { auth } from "@/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string; debug?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = await cookies();
  const params = await searchParams;
  
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const isDebug = params.debug === "1" || params.debug === "true" || typeof params.debug === "string";
  
  // URL params override the cookie
  let scope = params.scope || cookieStore.get("search_scope")?.value || "global";
  // Fallback to global if unauthorized
  if (scope === "my_events" && !userId) scope = "global";
  
  const { results, mode } = await globalSearch(query, scope as "global" | "my_events", userId);

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="google-page">
        <div className="google-search-bar-container">
          <form className="google-search-form" action="/search">
            <input
              className="google-search-input"
              name="q"
              defaultValue={query}
            />
            {scope === "my_events" && (
              <input type="hidden" name="scope" value="my_events" />
            )}
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
            {mode === "fallback" ? " (title search)" : ""}
          </p>

          {results.map((result) => (
            <article key={result.siteFileId} className="google-result">
              <h2>
                <a href={globalResultHref(result)}>
                  {result.title}
                </a>
              </h2>
              <div className="google-url">
                {(() => {
                  try {
                    return decodeURI(result.displayUrl);
                  } catch {
                    return result.displayUrl;
                  }
                })()}
              </div>
              <p>{result.snippet}</p>
              <div className="google-result-meta">
                {result.siteName} · {result.eventTitle}
              </div>
              {isDebug && result.debug && (
                <details className="score-debug">
                  <summary>Search score</summary>
                  <dl>
                    <div><dt>Total</dt><dd>{result.score.toFixed(4)}</dd></div>
                    <div><dt>Lexical raw</dt><dd>{result.debug.lexicalRaw.toFixed(4)}</dd></div>
                    <div><dt>Lexical weighted</dt><dd>{result.debug.lexicalRaw.toFixed(4)} × 0.35 = {result.debug.lexicalWeighted.toFixed(4)}</dd></div>
                    <div><dt>Title embedding</dt><dd>{result.debug.titleSimilarity.toFixed(4)} × 1.50 = {result.debug.titleWeighted.toFixed(4)}</dd></div>
                    <div><dt>Description embedding</dt><dd>{result.debug.descriptionSimilarity.toFixed(4)} × 1.00 = {result.debug.descriptionWeighted.toFixed(4)}</dd></div>
                    <div><dt>Site type embedding</dt><dd>{result.debug.siteNameSimilarity.toFixed(4)} × 1.25 = {result.debug.siteNameWeighted.toFixed(4)}</dd></div>
                    <div><dt>Semantic subtotal</dt><dd>{result.debug.semantic.toFixed(4)}</dd></div>
                  </dl>
                </details>
              )}
            </article>
          ))}

          {results.length === 0 && (
            <p className="google-empty">
              No pages found. Try another query
              {userId ? (
                <> or <a href={`/hub/events/new?title=${encodeURIComponent(query)}`}>create an event</a>.</>
              ) : (
                "."
              )}
            </p>
          )}
        </main>
      </div>
    </>
  );
}
