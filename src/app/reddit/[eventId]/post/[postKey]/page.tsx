import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { requireEventViewerPage } from "@/lib/event-access";
import { getRedditPost, RedditComment } from "@/lib/reddit";

export const dynamic = "force-dynamic";

function CommentTree({ comments }: { comments: RedditComment[] }) {
  return (
    <div className="reddit-comments">
      {comments.map((comment, index) => (
        <div key={`${comment.author}-${index}`} className="reddit-comment">
          <div className="reddit-comment-meta">
            {comment.author} · {comment.score} points
          </div>
          <p>{comment.body}</p>
          {comment.replies && comment.replies.length > 0 && (
            <CommentTree comments={comment.replies} />
          )}
        </div>
      ))}
    </div>
  );
}

export default async function RedditPostPage({
  params,
}: {
  params: Promise<{ eventId: string; postKey: string }>;
}) {
  const { eventId: eventIdStr, postKey } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const result = await getRedditPost(event.id, postKey);
  if (!result) notFound();

  const { post } = result;

  return (
    <>
    <BodyClass className="search-shell-body" />
    <div className="reddit-page">
      <header className="reddit-header">
        <a href={`/reddit/${event.id}`} className="reddit-logo">reddit</a>
        <span className="reddit-header-title">r/{post.subreddit}</span>
      </header>

      <main className="reddit-thread">
        <article className="reddit-thread-post">
          <div className="reddit-score">{post.score}</div>
          <div className="reddit-post-main">
            <h1>{post.title}</h1>
            <div className="reddit-post-meta">
              submitted {post.posted_at} by {post.author} to r/{post.subreddit}
            </div>
            <p className="reddit-post-body">{post.body}</p>
          </div>
        </article>

        <h2 className="reddit-comments-title">
          {post.comment_count || post.comments.length} comments
        </h2>
        <CommentTree comments={post.comments} />
      </main>
    </div>
    </>
  );
}
