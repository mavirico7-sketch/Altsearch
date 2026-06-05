import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getSiteFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";
import { getRedditCorpusFromFile } from "@/lib/reddit";

export const dynamic = "force-dynamic";

export default async function RedditPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "Reddit");
  const corpus = getRedditCorpusFromFile(event.id);
  if (!site || site.status !== "complete" || !corpus) notFound();

  return (
    <>
    <BodyClass className="search-shell-body" />
    <div className="reddit-page">
      <header className="reddit-header">
        <a href={`/search/${event.id}`} className="reddit-logo">reddit</a>
        <span className="reddit-header-title">{event.title}</span>
      </header>

      <main className="reddit-listing">
        <h1>{corpus.title}</h1>
        {corpus.description && <p className="reddit-description">{corpus.description}</p>}

        {corpus.posts.map((post, index) => (
          <article key={post.post_key} className="reddit-listing-post">
            <div className="reddit-rank">{index + 1}</div>
            <div className="reddit-score">{post.score}</div>
            <div className="reddit-post-main">
              <h2>
                <a href={`/reddit/${event.id}/post/${post.post_key}`}>
                  {post.title}
                </a>
              </h2>
              <div className="reddit-post-meta">
                submitted {post.posted_at} by {post.author} to r/{post.subreddit}
              </div>
              <div className="reddit-post-links">
                {post.comment_count || post.comments.length} comments
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
    </>
  );
}
