"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  // Set by /auth/callback when a link couldn't be used. Without this the page
  // silently showed the form again and looked like nothing had happened.
  const linkFailed = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="panel" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>
        Operator login
      </h2>
      {sent ? (
        <p style={{ color: "var(--ink-soft)" }}>
          Check <strong>{email}</strong> for a magic link. Open it in this
          browser to sign in: copy the link and paste it into this
          browser&apos;s address bar, rather than clicking it in your email.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {linkFailed ? (
            <p style={{ color: "var(--low)", fontSize: 14 }}>
              That sign-in link didn&apos;t work. A link works once, and only in
              the browser that requested it. Send a new one and open it here,
              in this same browser.
            </p>
          ) : null}
          <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
            Enter your operator email; we&apos;ll send a sign-in link.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--line-2)",
              borderRadius: 10,
              font: "inherit",
            }}
          />
          {error ? (
            <p style={{ color: "var(--low)", fontSize: 13 }}>{error}</p>
          ) : null}
          <button
            className="badge-plan"
            type="submit"
            disabled={loading}
            style={{ cursor: "pointer", padding: "10px 12px" }}
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </div>
  );
}
