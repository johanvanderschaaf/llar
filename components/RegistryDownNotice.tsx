"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { notifyWhenBackAction } from "@/app/[locale]/early-access/actions";

/**
 * Shown when Catastro (the land registry) is down, so no report can be made
 * right now. Explains it plainly and offers to email the report once it's
 * back, instead of the buyer seeing "no results" or a generic error and
 * leaving. Used in the address search and after a refused report.
 */
export function RegistryDownNotice({
  address,
  cadastralRef,
  askingPriceEur,
}: {
  /** What the buyer had typed or picked, so we know which flat they meant. */
  address?: string;
  cadastralRef?: string;
  askingPriceEur?: number;
}) {
  const t = useTranslations("registryDown");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "email" | "server">("idle");
  const [pending, startTransition] = useTransition();

  // Not a <form>: this notice is rendered inside the address picker's form, and
  // forms can't be nested. Enter is handled by hand instead.
  function submit() {
    if (pending) return;
    startTransition(async () => {
      const res = await notifyWhenBackAction({
        email,
        address,
        cadastralRef,
        askingPriceEur,
        locale,
      });
      setState(res.ok ? "ok" : res.error);
    });
  }

  return (
    <div
      className="panel"
      role="status"
      style={{
        borderColor: "var(--pw-caution)",
        background: "var(--pw-caution-soft)",
        display: "grid",
        gap: 12,
      }}
    >
      <strong style={{ color: "var(--pw-caution-700)" }}>{t("title")}</strong>
      <p style={{ fontSize: 14, margin: 0 }}>{t("body")}</p>
      {state === "ok" ? (
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--good)" }}>
          {t("ok")}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Don't let Enter submit the surrounding address form.
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("emailPlaceholder")}
            aria-label={t("emailPlaceholder")}
            style={{
              flex: "1 1 220px",
              padding: "10px 12px",
              border: "1.5px solid var(--pw-ink-200)",
              borderRadius: 12,
              font: "inherit",
              fontSize: 16,
              background: "#fff",
            }}
          />
          <button className="btn btn-primary" type="button" onClick={submit} disabled={pending}>
            {t("cta")}
          </button>
        </div>
      )}
      {state === "email" || state === "server" ? (
        <p style={{ fontSize: 13, margin: 0, color: "var(--low)" }}>
          {state === "email" ? t("errEmail") : t("errServer")}
        </p>
      ) : null}
    </div>
  );
}
