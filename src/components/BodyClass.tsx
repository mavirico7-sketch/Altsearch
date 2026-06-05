"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function BodyClass({ className }: { className?: string } = {}) {
  const pathname = usePathname();

  useEffect(() => {
    const isSearchShell =
      pathname === "/" ||
      pathname === "/create" ||
      pathname.startsWith("/search/") ||
      pathname.startsWith("/reddit/") ||
      pathname.startsWith("/youtube/") ||
      pathname.startsWith("/news/") ||
      pathname.startsWith("/chan/") ||
      pathname.startsWith("/console/");
    const shouldApply = isSearchShell || className === "search-shell-body";
    document.body.classList.toggle("search-shell-body", shouldApply);
    return () => document.body.classList.remove("search-shell-body");
  }, [pathname, className]);

  return null;
}
