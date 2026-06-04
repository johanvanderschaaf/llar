import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { signOutAction } from "./actions";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} · Operator`,
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        <div className="topbar">
          <div className="wrap" style={{ maxWidth: 1100 }}>
            <div className="brand">
              <span className="glyph">{brand.glyph}</span>
              {brand.name}
              <small>Operator</small>
            </div>
            <div className="topbar-right">
              {user ? (
                <>
                  <Link className="badge-plan" href="/admin">
                    Reports
                  </Link>
                  <Link className="badge-plan" href="/admin/new">
                    + New
                  </Link>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    {user.email}
                  </span>
                  <form action={signOutAction}>
                    <button className="lang-toggle" type="submit">
                      Sign out
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="wrap" style={{ maxWidth: 1100, padding: "32px 28px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
