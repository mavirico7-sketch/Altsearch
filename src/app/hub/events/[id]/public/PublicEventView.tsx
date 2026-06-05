"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSiteUrl } from "@/lib/sites-config";

type SiteData = {
  id: number;
  siteName: string;
  displayUrl: string;
  snippet: string;
};

export default function PublicEventView({
  eventId,
  notes,
  sites,
}: {
  eventId: string;
  notes: string;
  sites: SiteData[];
}) {
  const [activeTab, setActiveTab] = useState<"notes" | "sites">("notes");

  return (
    <section className="panel event-content">
      <div className="switcher" aria-label="Event sections">
        <button 
          className={activeTab === "notes" ? "active" : ""} 
          type="button"
          onClick={() => setActiveTab("notes")}
        >
          Event notes
        </button>
        <button 
          className={activeTab === "sites" ? "active" : ""} 
          type="button"
          onClick={() => setActiveTab("sites")}
        >
          Sites
        </button>
      </div>

      {activeTab === "notes" && (
        <div className="notes-view">
          <div className="panel-head">
            <div>
              <h2>Event notes</h2>
              <p>Internal lore and shared facts used by generated pages.</p>
            </div>
          </div>
          <article className="notes-document">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {notes || "_No internal notes available for this event._"}
            </ReactMarkdown>
          </article>
        </div>
      )}

      {activeTab === "sites" && (
        <div className="sites-view">
          <div className="panel-head">
            <div>
              <h2>Event sites</h2>
              <p>Open generated pages from this event.</p>
            </div>
          </div>
          <div className="site-list">
            {sites.length === 0 ? (
              <div style={{ padding: "30px", color: "#64748b", fontStyle: "italic" }}>
                No generated sites available yet.
              </div>
            ) : (
              sites.map((site) => {
                let decodedUrl = site.displayUrl;
                try {
                  decodedUrl = decodeURIComponent(site.displayUrl);
                } catch (e) {
                  // ignore decoding errors
                }
                
                return (
                  <Link 
                    key={site.id}
                    className="site-card" 
                    href={getSiteUrl(eventId, site.siteName)}
                  >
                    <b>{site.siteName}</b>
                    <p>{site.snippet}</p>
                    <em>{decodedUrl}</em>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
