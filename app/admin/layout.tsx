import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Space_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { Mark, Wordmark } from "@/components/Brand";
import { signOutAction } from "./actions";
import "../globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
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
    <html lang="en" className={`${manrope.variable} ${spaceMono.variable}`}>
      <body>
        <div className="topbar">
          <div className="wrap" style={{ maxWidth: 1100 }}>
            <span className="pw-lockup">
              <Mark size={26} />
              <Wordmark />
              <small
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginLeft: 4,
                }}
              >
                Operator
              </small>
            </span>
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
