import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import { getChanCorpusFromFile } from "@/lib/chan";
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
        <a className="chan-link" href={`/search/${eventId}`}>Return</a>
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

export default async function ChanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = eventIdStr;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventViewerPage(eventId);

  const site = await getSiteFile(event.id, "Anonboard");
  const corpus = getChanCorpusFromFile(event.id);
  if (!site || site.status !== "complete" || !corpus) notFound();

  return (
    <>
      <BodyClass className="search-shell-body" />
      <div className="chan-page">
        <Header eventId={event.id} />
        <main className="chan-shell">
          <div className="chan-title">
            <h1>{corpus.board} - {corpus.title}</h1>
            {corpus.description && <div className="chan-subtitle">{corpus.description}</div>}
          </div>

          <div className="chan-boardbar">Catalog mode</div>
          <div className="chan-actions">
            <span>[Start a New Thread]</span>
            <span>[Refresh]</span>
            <span>[Archive]</span>
          </div>

          <section className="chan-catalog" aria-label="Thread catalog">
            {corpus.threads.map((thread) => (
              <article className="chan-catalog-item" key={thread.thread_key}>
                <a className="chan-catalog-thumb" href={`/chan/${event.id}/thread/${thread.thread_key}`}>Image unavailable</a>
                <a className="chan-catalog-title" href={`/chan/${event.id}/thread/${thread.thread_key}`}>{thread.subject}</a>
                <div className="chan-catalog-meta">
                  {thread.board} · No.{thread.post_no}<br />
                  R: {thread.replies_count} / I: {thread.images_count}
                </div>
                <div className="chan-text">
                  <Greentext text={thread.op_body.split(/\r?\n/).slice(0, 4).join("\n")} />
                </div>
              </article>
            ))}
          </section>

          <div className="chan-boardbar">Active threads</div>
          {corpus.threads.slice(0, 3).map((thread) => (
            <section className="chan-thread-card" key={thread.thread_key}>
              <article className="chan-post chan-op chan-clear">
                <div className="chan-post-head">
                  <span className="chan-subject">{thread.subject}</span>{" "}
                  <span className="chan-name">Anonymous</span>{" "}
                  <span>{thread.posted_at}</span>{" "}
                  <span className="chan-number">No.{thread.post_no}</span>
                </div>
                <div className="chan-file">File: {thread.image} (image unavailable)</div>
                <a className="chan-thumb" href={`/chan/${event.id}/thread/${thread.thread_key}`}>No image</a>
                <div className="chan-text">
                  <Greentext text={thread.op_body} />
                </div>
              </article>
              <div className="chan-omitted">
                {Math.max(0, thread.replies_count - 3)} replies and {Math.max(0, thread.images_count - 1)} images omitted.{" "}
                <a href={`/chan/${event.id}/thread/${thread.thread_key}`}>Click here</a> to view.
              </div>
              <div className="chan-replies">
                {thread.replies.slice(0, 2).map((reply) => (
                  <article className="chan-post" key={reply.post_no}>
                    <div className="chan-post-head">
                      <span className="chan-name">Anonymous</span>{" "}
                      <span>{reply.posted_at}</span>{" "}
                      <span className="chan-number">No.{reply.post_no}</span>
                    </div>
                    <div className="chan-text"><Greentext text={reply.body} /></div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
