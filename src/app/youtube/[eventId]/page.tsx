import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getSiteFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";
import { getYouTubeCorpusFromFile } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return value > 0 ? value.toLocaleString("en-US") : "0";
}

export default async function YouTubePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "YouTube");
  const corpus = getYouTubeCorpusFromFile(event.id);
  if (!site || site.status !== "complete" || !corpus) notFound();

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="youtube-page">
        <header className="youtube-header">
          <a href={`/search/${event.id}`} className="youtube-logo">YouTube</a>
          <form className="youtube-search" action={`/search/${event.id}`}>
            <input value={event.title} readOnly />
            <button type="submit">Search</button>
          </form>
        </header>

        <main className="youtube-results">
          <h1>{corpus.title}</h1>
          {corpus.description && <p className="youtube-description">{corpus.description}</p>}

          {corpus.videos.map((video) => (
            <article key={video.video_key} className="youtube-result">
              <a className="youtube-thumb" href={`/youtube/${event.id}/watch/${video.video_key}`}>
                <span>Thumbnail unavailable</span>
                <b>{video.duration}</b>
              </a>
              <div className="youtube-result-main">
                <h2>
                  <a href={`/youtube/${event.id}/watch/${video.video_key}`}>
                    {video.title}
                  </a>
                </h2>
                <div className="youtube-meta">
                  {video.channel} · {formatCount(video.views)} views · {video.uploaded}
                </div>
                {video.description && <p>{video.description}</p>}
              </div>
            </article>
          ))}
        </main>
      </div>
    </>
  );
}
