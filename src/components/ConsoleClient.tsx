"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSiteUrl } from "@/lib/sites-config";

type ConsoleMessage = {
  id: number;
  role: "user" | "assistant" | "tool" | "summary";
  content: string;
};

type SiteFile = {
  id: number;
  siteName: string;
  status: "empty" | "complete";
  path: string;
  title: string;
  snippet: string;
  displayUrl: string;
};

type RunStatus = "queued" | "running" | "complete" | "failed";

function MessageContent({ message }: { message: ConsoleMessage }) {
  if (message.role === "tool") {
    const lines = message.content.split("\n");
    const name = lines[0]?.startsWith("tool_call: ") ? lines[0].replace("tool_call: ", "").trim() : lines[0]?.trim() || "unknown";
    let extra = "";
    try {
      const argsStr = lines.slice(1).join("\n");
      if (argsStr) {
        const args = JSON.parse(argsStr);
        if (args.path) extra += ` ${args.path}`;
        if (args.changeSummary) extra += ` - ${args.changeSummary}`;
      }
    } catch {}

    return (
      <div className="console-tool-status">
        Tool called: <code>{name}{extra}</code>
      </div>
    );
  }

  return (
    <div className="console-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>
    </div>
  );
}

export default function ConsoleClient({
  eventId,
  initialMessages,
  initialSites,
  initialNotes,
  initialRunStatus,
  eventTitle,
  initialIsPrivate,
  initialUpdatedAt,
}: {
  eventId: string;
  initialMessages: ConsoleMessage[];
  initialSites: SiteFile[];
  initialNotes: string;
  initialRunStatus: RunStatus;
  eventTitle: string;
  initialIsPrivate: boolean;
  initialUpdatedAt: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sites, setSites] = useState(initialSites);
  const [notes, setNotes] = useState(initialNotes);
  const [runStatus, setRunStatus] = useState<RunStatus>(initialRunStatus);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typingTokens, setTypingTokens] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastId = useMemo(() => messages.at(-1)?.id ?? 0, [messages]);
  const lastIdRef = useRef(lastId);
  lastIdRef.current = lastId;

  const isRunning = runStatus === "queued" || runStatus === "running" || isSubmitting;

  function mergeMessages(nextMessages: ConsoleMessage[]) {
    if (nextMessages.length === 0) return;
    setMessages((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const msg of nextMessages) {
        map.set(msg.id, msg);
      }
      return Array.from(map.values()).sort((a, b) => a.id - b.id);
    });
  }

  async function poll(after = Math.max(0, lastIdRef.current - 1)) {
    const res = await fetch(`/api/events/${eventId}/messages?after=${after}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    mergeMessages(data.messages ?? []);
    if (data.sites) setSites(data.sites);
    if (data.notes !== undefined) setNotes(data.notes);
    if (data.runStatus) setRunStatus(data.runStatus);
    if (data.updatedAt) setUpdatedAt(data.updatedAt);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if ((!text && attachedFiles.length === 0) || isRunning) return;
    if (viewerMode === "edit" && hasUnsavedChanges) {
      alert("Save or discard file edits before starting the agent.");
      return;
    }

    let textToSend = text;
    if (attachedFiles.length > 0) {
      textToSend += "\n\nAttached files:\n";
      for (const file of attachedFiles) {
        textToSend += `\n--- ${file.name} ---\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }
    }

    const optimisticId = -Date.now();
    setIsSubmitting(true);
    setMessage("");
    setAttachedFiles([]);
    setRunStatus("queued");
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "user",
        content: textToSend,
      },
    ]);

    const res = await fetch(`/api/events/${eventId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: textToSend }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      if (data.userMessage) {
        setMessages((current) => current.filter((item) => item.id !== optimisticId));
        mergeMessages([data.userMessage]);
      }
      if (data.sites) setSites(data.sites);
      if (data.notes !== undefined) setNotes(data.notes);
      setRunStatus(data.runStatus ?? "queued");
      if (data.updatedAt) setUpdatedAt(data.updatedAt);
    } else {
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticId),
        {
          id: Date.now(),
          role: "assistant",
          content: data.error ?? `HTTP ${res.status}`,
        },
      ]);
      setRunStatus("failed");
    }

    setIsSubmitting(false);
  }

  useEffect(() => {
    const es = new EventSource(`/api/events/${eventId}/stream`);
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "typing") {
          setTypingTokens(data.tokens);
        } else if (data.type === "refresh") {
          void poll();
        }
      } catch (err) {}
    });
    return () => es.close();
  }, [eventId]); // only reconnect if eventId changes

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typingTokens]);

  const visibleMessages = messages.filter((item) => (
    item.role !== "summary" &&
    (item.role !== "tool" || item.content.startsWith("tool_call:"))
  ));

  const [activeSiteId, setActiveSiteId] = useState<number | "notes" | null>("notes");
  const activeSite = activeSiteId === "notes" 
    ? { id: "notes", siteName: "Event Notes", status: "complete" as const, path: "event-notes.md", title: "", snippet: "", displayUrl: "" }
    : sites.find(s => s.id === activeSiteId);
  const [viewerMode, setViewerMode] = useState<"preview" | "edit">("preview");
  const [editingContent, setEditingContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSnippet, setEditingSnippet] = useState("");
  const [editingUrl, setEditingUrl] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedContentHash, setLoadedContentHash] = useState("");
  const [loadedMetadataHash, setLoadedMetadataHash] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (viewerMode === "edit" && activeSite) {
      if (activeSite.siteName === "Event Notes") {
        fetch(`/api/events/${eventId}/files?path=${encodeURIComponent(activeSite.path)}`)
          .then(r => r.json())
          .then(d => {
            setEditingContent(d.content || notes);
            setEditingTitle("");
            setEditingSnippet("");
            setEditingUrl("");
            setLoadedContentHash(d.contentHash || "");
            setLoadedMetadataHash(null);
            setHasUnsavedChanges(false);
          });
      } else if (activeSite.status === "complete") {
        fetch(`/api/events/${eventId}/files?path=${encodeURIComponent(activeSite.path)}`)
          .then(r => r.json())
          .then(d => {
            setEditingContent(d.content || "");
            setEditingTitle(activeSite.title);
            setEditingSnippet(activeSite.snippet);
            setEditingUrl(activeSite.displayUrl);
            setLoadedContentHash(d.contentHash || "");
            setLoadedMetadataHash(d.metadataHash ?? null);
            setHasUnsavedChanges(false);
          });
      } else {
        setEditingContent("");
        setEditingTitle("");
        setEditingSnippet("");
        setEditingUrl("");
        setLoadedContentHash("");
        setLoadedMetadataHash(null);
        setHasUnsavedChanges(false);
      }
    }
  }, [viewerMode, activeSite?.id, eventId, notes]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  function switchActiveSite(nextSiteId: number | "notes") {
    if (viewerMode === "edit" && hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Discard them and switch files?")) return;
    }
    setActiveSiteId(nextSiteId);
  }

  async function handleSaveFile() {
    if (!activeSite || isSaving) return;
    setIsSaving(true);
    const path = activeSite.path;
    try {
      const payload: Record<string, string> = { path, content: editingContent };
      if (loadedContentHash) payload.baseContentHash = loadedContentHash;
      if (activeSite.siteName !== "Event Notes") {
        payload.siteName = activeSite.siteName;
        payload.title = editingTitle;
        payload.snippet = editingSnippet;
        payload.displayUrl = editingUrl;
        if (loadedMetadataHash) payload.baseMetadataHash = loadedMetadataHash;
      }
      const res = await fetch(`/api/events/${eventId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setHasUnsavedChanges(false);
        setLoadedContentHash("");
        setLoadedMetadataHash(null);
        if (activeSite.siteName === "Event Notes") {
          setNotes(editingContent);
        }
        void poll();
      } else if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "This file changed since you opened it. Reload the latest version before saving.");
        setViewerMode("preview");
        void poll();
      } else {
        alert("Failed to save file.");
      }
    } catch (err) {
      alert("Error saving file.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSite() {
    if (!activeSite || isDeleting || activeSite.siteName === "Event Notes") return;
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard them and delete this site?")) return;
    if (!confirm(`Are you sure you want to delete the contents of ${activeSite.siteName}? This will reset it to "Missing".`)) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/files?siteName=${encodeURIComponent(activeSite.siteName)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setViewerMode("preview");
        void poll();
      } else {
        alert("Failed to delete site.");
      }
    } catch (err) {
      alert("Error deleting site.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="editor-layout">
      <section className="chat-pane" aria-label="Event chat">
        <header className="chat-head">
          <div>
            <p className="eyebrow">Event #{eventId}</p>
            <h1>{eventTitle}</h1>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a href={`/hub/events/${eventId}/public`} className="button" target="_blank" rel="noreferrer">
              Public Event
            </a>
            <a href={`/api/events/${eventId}/export`} className="button" download>
              Export ZIP
            </a>
            <span className="run-status" style={{
              background: isRunning ? "#e8f0fe" : "#f1f8f1",
              color: isRunning ? "#1a73e8" : "#188038",
              borderColor: isRunning ? "#d2e3fc" : "#c8e6c9"
            }}>
              {isRunning ? "Agent running..." : "Agent idle"}
            </span>
          </div>
        </header>

        <div className="event-strip" aria-label="Event summary">
          <dl>
            <div><dt>Status</dt><dd>Draft</dd></div>
            <div><dt>Visibility</dt><dd>{isPrivate ? "Private" : "Public"}</dd></div>
            <div><dt>Sites</dt><dd>{sites.filter(s => s.status === 'complete').length} / {sites.length}</dd></div>
            <div>
              <dt>Last updated</dt>
              <dd>{new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
            <div><dt>Action</dt><dd>{runStatus}</dd></div>
          </dl>
        </div>

        <div className="thread">
          {visibleMessages.length === 0 ? (
            <div className="console-empty" style={{ textAlign: "center", color: "#5f6368", marginTop: "40px" }}>
              Write what you want to create or discuss. The agent will respond and update files.
            </div>
          ) : (
            <>
              {visibleMessages.map((item) => (
                <article key={item.id} className={`post ${item.role}`}>
                  <div className="post-meta">
                    <b>{item.role === "user" ? "You" : item.role === "assistant" ? "AltSearch Agent" : "Tool run"}</b>
                  </div>
                  <div className="post-body">
                    <MessageContent message={item} />
                  </div>
                </article>
              ))}
              {typingTokens !== null && (
                <div className="console-typing-indicator" style={{ color: "#188038", fontFamily: "monospace", padding: "8px 0" }}>
                  <span className="blink">...</span> Agent is typing... ({typingTokens} tokens)
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} style={{ height: "1px" }} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          {attachedFiles.length > 0 && (
            <div className="composer-attachments">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="attachment-chip">
                  <span>{file.name}</span>
                  <button type="button" onClick={() => setAttachedFiles(current => current.filter((_, i) => i !== idx))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            name="message"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a command, event detail, or site request..."
            required
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <div className="composer-actions">
            <input 
              type="file" 
              multiple 
              accept=".txt,.md,.csv,.json" 
              style={{ display: "none" }} 
              ref={fileInputRef}
              onChange={async (e) => {
                const files = e.target.files;
                if (!files) return;
                const newAttachments: {name: string, content: string}[] = [];
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  try {
                    const content = await file.text();
                    newAttachments.push({ name: file.name, content });
                  } catch (err) {
                    console.error("Failed to read file", file.name, err);
                  }
                }
                setAttachedFiles(current => [...current, ...newAttachments]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}>Attach file</button>
            {isRunning ? (
              <button 
                className="secondary" 
                type="button" 
                onClick={async function handleStopRun() {
                  setIsSubmitting(true);
                  try {
                    await fetch(`/api/events/${eventId}/stop`, { method: "POST" });
                    setRunStatus("failed");
                    void poll();
                  } catch (e) {
                    console.error("Failed to stop", e);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                style={{ color: "#c5221f", borderColor: "#c5221f" }}
              >
                Stop
              </button>
            ) : (
              <button className="primary" type="submit" disabled={!message.trim() || (viewerMode === "edit" && hasUnsavedChanges)}>
                Send
              </button>
            )}
          </div>
        </form>
      </section>

      <aside className="files-pane" aria-label="Event files">
        <header className="files-head">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>Event files</h2>
          </div>
          <div className="files-actions">
            <button className="publish" type="button" onClick={async () => {
              if (viewerMode === "edit" && hasUnsavedChanges && !confirm("You have unsaved changes. Discard them and delete this event?")) return;
              if (confirm("Are you sure you want to delete this event?")) {
                const formData = new FormData();
                formData.append("eventId", String(eventId));
                const { deleteEventAction } = await import("@/actions/delete-event");
                await deleteEventAction(formData);
              }
            }} style={{ background: "transparent", color: "#c5221f", borderColor: "#c5221f", marginRight: "8px" }}>Delete</button>
            <button className="publish" type="button" onClick={async () => {
              const formData = new FormData();
              formData.append("eventId", String(eventId));
              formData.append("isPrivate", String(!isPrivate));
              const { publishEventAction } = await import("@/actions/publish-event");
              await publishEventAction(formData);
              setIsPrivate(!isPrivate);
            }}>
              {isPrivate ? "Publish" : "Unpublish"}
            </button>
          </div>
        </header>

        <div className="file-workspace">
          <div className="file-list">

            <button 
              className={activeSiteId === "notes" ? "active" : ""} 
              type="button"
              onClick={() => switchActiveSite("notes")}
            >
              <b>Event Notes</b>
              <span style={{ color: '#188038' }}>Document</span>
            </button>

            {sites.map(site => (
              <button 
                key={site.id} 
                className={activeSiteId === site.id ? "active" : ""} 
                type="button"
                onClick={() => switchActiveSite(site.id)}
              >
                <b>{site.siteName}</b>
                <span style={{ color: site.status === 'complete' ? '#188038' : '#5f6368' }}>
                  {site.status === 'complete' ? 'Generated' : 'Missing'}
                </span>
              </button>
            ))}
          </div>

          <section className="file-viewer">
            <div className="viewer-toolbar">
              <span>{activeSite?.siteName ?? "No file selected"}</span>
              {activeSite && (
                <div className="viewer-actions">
                  {activeSite.siteName !== "Event Notes" && (
                    <a href={getSiteUrl(eventId, activeSite.siteName)} target="_blank" rel="noreferrer" className="button" style={{ padding: "4px 8px", fontSize: "12px", background: "#f1f3f4", color: "#3c4043", border: "1px solid #dadce0" }}>
                      Open tab
                    </a>
                  )}
                  <div className="mode-switch">
                    <button 
                      className={viewerMode === "preview" ? "active" : ""} 
                      type="button" 
                      onClick={() => {
                        if (viewerMode === "edit" && hasUnsavedChanges && !confirm("Discard unsaved changes and return to preview?")) return;
                        setViewerMode("preview");
                      }}
                    >Preview</button>
                    <button 
                      className={viewerMode === "edit" ? "active" : ""} 
                      type="button" 
                      onClick={() => setViewerMode("edit")}
                    >Edit</button>
                  </div>
                  {activeSite.siteName !== "Event Notes" && (
                    <button 
                      type="button" 
                      onClick={handleDeleteSite} 
                      disabled={isDeleting || isRunning || activeSite.status !== "complete"}
                      style={{ color: "#c5221f", border: "1px solid #c5221f", background: "transparent", padding: "4px 8px" }}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                  {viewerMode === "edit" && hasUnsavedChanges && (
                    <span className="save-state">Unsaved changes</span>
                  )}
                  {viewerMode === "edit" && (
                    <button className="file-save" type="button" onClick={handleSaveFile} disabled={!hasUnsavedChanges || isSaving || isRunning}>
                      {isSaving ? "Saving..." : isRunning ? "Agent working..." : "Save"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div 
              className={`document ${activeSite?.siteName === "Event Notes" && viewerMode === "preview" ? "console-markdown" : ""}`}
              style={{ padding: activeSite?.siteName && activeSite.siteName !== "Event Notes" && viewerMode === "preview" ? 0 : undefined, display: "flex", flexDirection: "column", height: "100%" }}
            >
              {viewerMode === "edit" && activeSite ? (
                <>
                  {activeSite.siteName !== "Event Notes" && (
                    <div style={{ padding: "16px", borderBottom: "1px solid #dadce0", display: "flex", flexDirection: "column", gap: "12px", background: "#f8f9fa", flexShrink: 0 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: "bold", color: "#5f6368" }}>
                        Title
                        <input type="text" value={editingTitle} onChange={(e) => { setEditingTitle(e.target.value); setHasUnsavedChanges(true); }} readOnly={isRunning} style={{ padding: "8px", border: "1px solid #dadce0", borderRadius: "4px", fontSize: "14px", fontFamily: "sans-serif" }} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: "bold", color: "#5f6368" }}>
                        URL
                        <input type="text" value={editingUrl} onChange={(e) => { setEditingUrl(e.target.value); setHasUnsavedChanges(true); }} readOnly={isRunning} style={{ padding: "8px", border: "1px solid #dadce0", borderRadius: "4px", fontSize: "14px", fontFamily: "sans-serif" }} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: "bold", color: "#5f6368" }}>
                        Snippet
                        <textarea value={editingSnippet} onChange={(e) => { setEditingSnippet(e.target.value); setHasUnsavedChanges(true); }} readOnly={isRunning} rows={2} style={{ padding: "8px", border: "1px solid #dadce0", borderRadius: "4px", fontSize: "14px", fontFamily: "sans-serif", resize: "vertical" }} />
                      </label>
                    </div>
                  )}
                  <textarea
                    className="editor-textarea"
                    value={editingContent}
                    readOnly={isRunning}
                    onChange={(e) => {
                      setEditingContent(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    style={{ flexGrow: 1, width: "100%", minHeight: "60vh", padding: "16px", boxSizing: "border-box", border: "none", resize: "none", fontFamily: "monospace", opacity: isRunning ? 0.7 : 1 }}
                  />
                </>
              ) : activeSite?.siteName === "Event Notes" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {notes || "_No notes yet._"}
                </ReactMarkdown>
              ) : activeSite ? (
                activeSite.status === "complete" ? (
                  <iframe 
                    src={getSiteUrl(eventId, activeSite.siteName)} 
                    className="site-preview-frame"
                    title={`Preview of ${activeSite.siteName}`}
                  />
                ) : (
                  <div style={{ color: "#5f6368", fontStyle: "italic", marginTop: "20px" }}>
                    This site has not been generated yet.
                  </div>
                )
              ) : (
                <div style={{ color: "#5f6368", fontStyle: "italic", marginTop: "20px" }}>
                  Select a file from the list to view.
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
}
