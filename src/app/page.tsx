import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <div className="search-home">
      <div className="search-home-brand">
        <h1 aria-label={SITE_NAME} className="search-home-wordmark">
          <span className="wordmark-blue">A</span>
          <span className="wordmark-red">l</span>
          <span className="wordmark-yellow">t</span>
          <span className="wordmark-blue">S</span>
          <span className="wordmark-green">e</span>
          <span className="wordmark-red">a</span>
          <span className="wordmark-yellow">r</span>
          <span className="wordmark-blue">c</span>
          <span className="wordmark-green">h</span>
        </h1>
        <p>Search the generated alternative internet.</p>
      </div>

      <form action="/search" className="search-home-form">
        <div className="search-home-field">
          <label htmlFor="q">Search query</label>
          <input
            id="q"
            name="q"
            type="text"
            required
            placeholder="e.g. Mbandaka virus reddit"
            className="search-home-input"
            maxLength={255}
          />
        </div>
        <div className="search-home-actions search-home-actions-row">
          <button type="submit" className="search-home-button">Search</button>
          <button type="submit" name="btnI" value="1" className="search-home-button search-home-link-button">I'm feeling lucky</button>
        </div>
      </form>

    </div>
  );
}
