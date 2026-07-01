"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { joinWaitlistAction } from "@/app/[locale]/early-access/actions";

const SAMPLE_ID = "sample-sors35";

export function EarlyAccessPage() {
  const t = useTranslations("earlyAccess");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [door, setDoor] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<"email" | "server" | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("email");
      (document.getElementById("ea-email") as HTMLInputElement | null)?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await joinWaitlistAction({
        email: trimmed,
        address: address.trim(),
        floor: floor.trim(),
        door: door.trim(),
        locale,
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.error);
        if (res.error === "email") {
          (document.getElementById("ea-email") as HTMLInputElement | null)?.focus();
        }
      }
    });
  }

  function echoFlat(): { label: string; flat: string; hasFlat: boolean } {
    const detail: string[] = [];
    if (floor.trim()) detail.push(`${t("echoFloor")} ${floor.trim()}`);
    if (door.trim()) detail.push(`${t("echoDoor")} ${door.trim()}`);
    const addr = address.trim();
    const flat = detail.length
      ? addr
        ? `${addr} · ${detail.join(", ")}`
        : detail.join(", ")
      : addr;
    return flat
      ? { label: t("okQueueLabel"), flat, hasFlat: true }
      : { label: t("okQueueNoneLabel"), flat: t("okQueueNone"), hasFlat: false };
  }

  const echo = echoFlat();

  return (
    <main className="ea-main">
      <div className="ea-col">
        {/* signal mark */}
        <div className="ea-signal" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none">
            <path
              className="ea-line"
              d="M3 17 L9 10 L13 14 L21 4.5"
              stroke="#5B92F2"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="ea-dot" cx="21" cy="4.5" r="2.4" fill="#5B92F2" />
          </svg>
        </div>

        {!submitted && (
          <>
            <span className="ea-eyebrow">
              <span className="ea-status-dot" />
              {t("eyebrow")}
            </span>

            <h1 className="ea-h1">
              {t.rich("h1", {
                em: (c) => <em>{c}</em>,
              })}
            </h1>

            <p className="ea-sub">{t("sub")}</p>
          </>
        )}

        {/* success state */}
        {submitted && (
          <div className="ea-success" aria-live="polite">
            <div className="ea-success-badge">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>{t("okTitle")}</h2>
            <p>
              {t("okBodyPre")}{" "}
              <b>{email.trim()}</b>{" "}
              {t("okBodyPost")}
            </p>
            <div className="ea-success-echo">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 11l9-7 9 7M5 10v9h14v-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                <b>{echo.label}</b>
                <span className={echo.hasFlat ? undefined : "ea-muted"}>{echo.flat}</span>
              </span>
            </div>
          </div>
        )}

        {/* form card — hidden after submit */}
        {!submitted && (
          <>
            <form className="ea-card" onSubmit={handleSubmit} noValidate>
              {/* email */}
              <div className="ea-field">
                <label className="ea-label" htmlFor="ea-email">
                  {t("labelEmail")}
                </label>
                <input
                  className="ea-input"
                  type="email"
                  id="ea-email"
                  name="email"
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              {/* which flat (optional) */}
              <div className="ea-field">
                <label className="ea-label" htmlFor="ea-flat">
                  {t("labelFlat")}
                  <span className="ea-opt">{t("optional")}</span>
                </label>
                <input
                  className="ea-input"
                  type="text"
                  id="ea-flat"
                  name="flat"
                  placeholder={t("phFlat")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <div className="ea-field-row">
                  <input
                    className="ea-input"
                    type="text"
                    name="floor"
                    inputMode="text"
                    placeholder={t("phFloor")}
                    aria-label={t("echoFloor")}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                  />
                  <input
                    className="ea-input"
                    type="text"
                    name="door"
                    inputMode="text"
                    placeholder={t("phDoor")}
                    aria-label={t("echoDoor")}
                    value={door}
                    onChange={(e) => setDoor(e.target.value)}
                  />
                </div>
                <p className="ea-hint">{t("hintFlat")}</p>
              </div>

              {error && (
                <p className="ea-err" role="alert">
                  {error === "email" ? t("err") : t("errServer")}
                </p>
              )}

              <button className="ea-submit" type="submit" disabled={pending}>
                {t("cta")}
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>

            <p className="ea-reassure">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("reassure")}
            </p>
          </>
        )}

        {/* below: sample link + source chips */}
        <div className="ea-below">
          <Link href={`/report/${SAMPLE_ID}`} className="ea-sample-link">
            {t("sampleLink")}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="ea-chips">
            {["Catastro", "ICAEN", "Mapa Urbanístic", "SNCZI", "Ajuntament BCN"].map(
              (s) => (
                <span key={s} className="ea-chip">{s}</span>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
