"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventTitleAction } from "@/actions/get-event-title";

export default function TopNav({ isAuthenticated, initialScope }: { isAuthenticated?: boolean, initialScope?: string }) {
  const pathname = usePathname() || "";
  const params = useParams() || {};
  const searchParams = useSearchParams();
  
  const eventId = (params.eventId || params.id) as string | undefined;
  const isSearch = pathname.startsWith("/search");
  
  const urlScope = searchParams?.get("scope");
  const query = searchParams?.get("q") || "";

  // Maintain client state for scope across soft navigations (e.g., when urlScope becomes null on /hub)
  const [clientScope, setClientScope] = useState<string>(initialScope || "global");

  useEffect(() => {
    if (urlScope) {
      setClientScope(urlScope);
    }
  }, [urlScope]);

  const scope = urlScope || clientScope;
  
  // An event page is either the hub editor or a public site for that event.
  const isEventPage = !!eventId;
  const isHubOnly = pathname.startsWith("/hub") && !isEventPage;

  const [eventTitle, setEventTitle] = useState("Loading...");

  useEffect(() => {
    if (eventId) {
      getEventTitleAction(eventId).then(title => {
        setEventTitle(title);
      });
    }
  }, [eventId]);
  
  // Build toggle URLs
  const searchBase = query ? `/search?q=${encodeURIComponent(query)}` : `/search?q=`;
  const toggleScopeToMyEvents = `${searchBase}&scope=my_events`;
  const toggleScopeToGlobal = `${searchBase}&scope=global`;

  const handleSetScope = (newScope: string) => {
    document.cookie = `search_scope=${newScope}; path=/; max-age=31536000`;
    setClientScope(newScope);
  };

  return (
    <nav className="global-topnav" aria-label="Main sections">
      <Link className={isHubOnly ? "active" : ""} href="/hub">Hub</Link>
      
      <div className={`topnav-search-group ${isSearch ? "active" : ""}`}>
        <Link href={scope === "my_events" ? toggleScopeToMyEvents : toggleScopeToGlobal} className="topnav-search-link">Search</Link>
        {isAuthenticated && (
          <div className="topnav-scope-toggle">
            <Link 
              href={toggleScopeToGlobal} 
              className={`scope-btn ${scope !== "my_events" ? "active" : ""}`}
              onClick={() => handleSetScope("global")}
            >Global</Link>
            <Link 
              href={toggleScopeToMyEvents} 
              className={`scope-btn ${scope === "my_events" ? "active" : ""}`}
              onClick={() => handleSetScope("my_events")}
            >Mine</Link>
          </div>
        )}
      </div>

      {eventId && (
        <Link className={isEventPage ? "active" : ""} href={`/hub/events/${eventId}`}>
          Event: {eventTitle}
        </Link>
      )}
    </nav>
  );
}
