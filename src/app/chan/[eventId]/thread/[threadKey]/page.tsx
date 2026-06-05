import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getChanThread } from "@/lib/chan";
import { getSiteFile } from "@/lib/event-files";
import { requireEventViewerPage } from "@/lib/event-access";

export const dynamic = "force-dynamic";

function Header({ eventId }: { eventId: string }) {
  return (
    <header className="chan-top">
      <div className="chan-top-row">
        <nav className="chan-boards" aria-label="Boards">
          <a href="#">/b/</a>
          <a href="#">/x/</a>
          <a href="#">/news/</a>
          <a href="#">/sci/</a>
          <a href="#">/g/</a>
          <a href="#">/pol/</a>
          <a href="#">/k/</a>
          <a href="#">/out/</a>
        </nav>
        <a className="chan-link" href={`/chan/${eventId}`}>Catalog</a>
      </div>
    </header>
  );
}

function Greentext({ text }: { text: string }) {
  return (
    <>
      {text.split(/\r?\n/).map((line, index) => (
        line.startsWith(">") ? (
          <p className="chan-green" key={index}>{line}</p>
        ) : (
          <p key={index}>{line || "\u00a0"}</p>
        )
      ))}
    </>
  );
}

export default async function ChanThreadPage({
  params,
}: {
  params: Promise<{ eventId: string; threadKey: string }>;
}) {
  const { eventId: eventIdStr, threadKey } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "Anonboard");
  const result = await getChanThread(event.id, threadKey);
  if (!site || site.status !== "complete" || !result) notFound();

  const { corpus, thread } = result;

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="chan-page">
        <Header eventId={event.id} />
        <main className="chan-shell">
          <div className="chan-title">
            <h1>{thread.board} - {corpus.title}</h1>
            <div className="chan-subtitle">Thread No.{thread.post_no}</div>
          </div>

          <div className="chan-boardbar">{thread.subject}</div>
          <div className="chan-actions">
            <a href={`/chan/${event.id}`} className="chan-button">Return</a>
            <span>[Update]</span>
            <span>[Bottom]</span>
            <span>[Archive]</span>
          </div>

          <article className="chan-post chan-op chan-clear">
            <div className="chan-post-head">
              <span className="chan-subject">{thread.subject}</span>{" "}
              <span className="chan-name">Anonymous</span>{" "}
              <span>{thread.posted_at}</span>{" "}
              <span className="chan-number">No.{thread.post_no}</span>
            </div>
            <div className="chan-file">File: {thread.image} (image unavailable)</div>
            <div className="chan-thumb">No image</div>
            <div className="chan-text"><Greentext text={thread.op_body} /></div>
          </article>

          <div className="chan-replies">
            {thread.replies.map((reply) => (
              <article className="chan-post" key={reply.post_no}>
                <div className="chan-post-head">
                  <span className="chan-name">Anonymous</span>{" "}
                  <span>{reply.posted_at}</span>{" "}
                  <a className="chan-number" href={`#p${reply.post_no}`} id={`p${reply.post_no}`}>No.{reply.post_no}</a>
                </div>
                <div className="chan-text"><Greentext text={reply.body} /></div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
