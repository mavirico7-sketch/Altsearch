import type { Metadata } from "next";
import "./globals.css";
import "./wikipedia.css";
import BodyClass from "@/components/BodyClass";
import Topbar from "@/components/Topbar";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BodyClass />
        <Topbar />
        {children}
      </body>
    </html>
  );
}
