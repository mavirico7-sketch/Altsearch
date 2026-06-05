import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { requireEventViewerPage } from "@/lib/event-access";
import { getYouTubeVideo, YouTubeComment } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return value > 0 ? value.toLocaleString("en-US") : "0";
}

function countComments(comments: YouTubeComment[]): number {
  return comments.reduce((sum, comment) => (
    sum + 1 + countComments(comment.replies ?? [])
  ), 0);
}

function CommentTree({ comments }: { comments: YouTubeComment[] }) {
  return (
    <div className="youtube-comments">
      {comments.map((comment, index) => (
        <div key={`${comment.author}-${index}`} className="youtube-comment">
          <div className="youtube-comment-avatar">{comment.author.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="youtube-comment-meta">
              {comment.author} · {comment.score} likes
            </div>
            <p>{comment.body}</p>
            {comment.replies && comment.replies.length > 0 && (
              <CommentTree comments={comment.replies} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function YouTubeWatchPage({
  params,
}: {
  params: Promise<{ eventId: string; videoKey: string }>;
}) {
  const { eventId: eventIdStr, videoKey } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const result = await getYouTubeVideo(event.id, videoKey);
  if (!result) notFound();

  const { corpus, video } = result;
  const related = corpus.videos.filter((item) => item.video_key !== video.video_key);

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="youtube-page">
        <header className="youtube-header">
          <a href={`/youtube/${event.id}`} className="youtube-logo">YouTube</a>
          <form className="youtube-search" action={`/search/${event.id}`}>
            <input value={event.title} readOnly />
            <button type="submit">Search</button>
          </form>
        </header>

        <main className="youtube-watch">
          <section className="youtube-watch-main">
            <div className="youtube-player">
              <span>Video unavailable</span>
            </div>
            <h1>{video.title}</h1>
            <div className="youtube-watch-meta">
              {formatCount(video.views)} views · {video.uploaded}
            </div>
            <div className="youtube-watch-channel">
              <div className="youtube-channel-avatar">{video.channel.slice(0, 1).toUpperCase()}</div>
              <div>
                <b>{video.channel}</b>
                <p>{formatCount(video.likes)} likes</p>
              </div>
            </div>
            {video.description && (
              <p className="youtube-video-description">{video.description}</p>
            )}

            <h2 className="youtube-comments-title">{countComments(video.comments)} comments</h2>
            <CommentTree comments={video.comments} />
          </section>

          <aside className="youtube-related" aria-label="Related videos">
            <h2>Related videos</h2>
            {related.map((item) => (
              <article key={item.video_key} className="youtube-related-item">
                <a className="youtube-related-thumb" href={`/youtube/${event.id}/watch/${item.video_key}`}>
                  <span>Thumbnail unavailable</span>
                  <b>{item.duration}</b>
                </a>
                <div>
                  <h3>
                    <a href={`/youtube/${event.id}/watch/${item.video_key}`}>{item.title}</a>
                  </h3>
                  <p>{item.channel}</p>
                  <p>{formatCount(item.views)} views</p>
                </div>
              </article>
            ))}
          </aside>
        </main>
      </div>
    </>
  );
}
