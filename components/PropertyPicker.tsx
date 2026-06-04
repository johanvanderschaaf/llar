"use client";

import { useEffect, useRef, useState } from "react";

interface Street {
  tipo: string;
  nombre: string;
}
interface Unit {
  ref: string;
  label: string;
  floor?: string;
  door?: string;
}

export interface PickerLabels {
  street: string;
  streetPlaceholder: string;
  number: string;
  find: string;
  finding: string;
  selectUnit: string;
  noRecords: string;
  manualSummary: string;
  askingPrice: string;
  email?: string;
  emailHint?: string;
  selected: string;
  submit: string;
}

const inputStyle = {
  padding: "12px 14px",
  border: "1.5px solid var(--pw-ink-200)",
  borderRadius: 12,
  font: "inherit",
  fontSize: 16,
  width: "100%",
  background: "#fff",
} as const;
const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "var(--ink-soft)",
  marginBottom: 6,
  display: "block",
};

/**
 * Reusable Barcelona address → unit picker (Catastro autocomplete). Labels are
 * passed in as plain strings so it works in both the localized buyer flow and
 * the English operator flow. Submits hidden `cadastralRef` + `addressOrRef`
 * (plus any `extraHidden`) to the given server action.
 */
export function PropertyPicker({
  action,
  labels,
  withEmail = false,
  showExtras = false,
  extraHidden = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  labels: PickerLabels;
  withEmail?: boolean;
  showExtras?: boolean;
  extraHidden?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [streets, setStreets] = useState<Street[]>([]);
  const [showList, setShowList] = useState(false);
  const [street, setStreet] = useState<Street | null>(null);
  const [number, setNumber] = useState("");
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [resolved, setResolved] = useState<Unit | null>(null);
  const [manualRef, setManualRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (street && query === `${street.tipo} ${street.nombre}`) return;
    if (query.trim().length < 2) {
      setStreets([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(
        `/api/catastro/streets?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await res.json();
      setStreets(data.streets ?? []);
      setShowList(true);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, street]);

  function pickStreet(s: Street) {
    setStreet(s);
    setQuery(`${s.tipo} ${s.nombre}`);
    setShowList(false);
    setUnits(null);
    setResolved(null);
  }

  async function findUnits() {
    if (!street || !number.trim()) return;
    setLoadingUnits(true);
    setUnits(null);
    setResolved(null);
    const res = await fetch(
      `/api/catastro/units?tv=${encodeURIComponent(street.tipo)}&nv=${encodeURIComponent(
        street.nombre,
      )}&num=${encodeURIComponent(number.trim())}`,
    );
    const data = await res.json();
    setUnits(data.units ?? []);
    setLoadingUnits(false);
  }

  const activeRef = resolved?.ref || manualRef.trim();
  const activeLabel = resolved?.label || manualRef.trim();

  return (
    <form
      action={action}
      onSubmit={() => setSubmitting(true)}
      style={{ display: "grid", gap: 18 }}
    >
      <input type="hidden" name="cadastralRef" value={activeRef} />
      <input type="hidden" name="addressOrRef" value={activeLabel} />
      {Object.entries(extraHidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {/* Street autocomplete */}
      <div style={{ position: "relative" }}>
        <label style={labelStyle}>{labels.street}</label>
        <input
          style={inputStyle}
          placeholder={labels.streetPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setStreet(null);
          }}
          onFocus={() => streets.length > 0 && setShowList(true)}
          autoComplete="off"
        />
        {showList && streets.length > 0 && (
          <div
            style={{
              position: "absolute",
              zIndex: 5,
              top: "100%",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid var(--pw-ink-200)",
              borderRadius: 12,
              marginTop: 4,
              boxShadow: "var(--pw-sh-2)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {streets.map((s, i) => (
              <button
                key={`${s.tipo}-${s.nombre}-${i}`}
                type="button"
                onClick={() => pickStreet(s)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--line)",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <strong>{s.tipo}</strong> {s.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Number + find */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div style={{ width: 150 }}>
          <label style={labelStyle}>{labels.number}</label>
          <input
            style={inputStyle}
            inputMode="numeric"
            placeholder="35"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={findUnits}
          disabled={!street || !number.trim() || loadingUnits}
          style={{
            padding: "12px 18px",
            opacity: !street || !number.trim() ? 0.5 : 1,
          }}
        >
          {loadingUnits ? labels.finding : labels.find}
        </button>
      </div>

      {/* Unit results */}
      {units && units.length > 0 && (
        <div>
          <label style={labelStyle}>{labels.selectUnit}</label>
          <div style={{ display: "grid", gap: 8 }}>
            {units.map((u) => {
              const active = resolved?.ref === u.ref;
              return (
                <button
                  key={u.ref}
                  type="button"
                  onClick={() => setResolved(u)}
                  style={{
                    textAlign: "left",
                    padding: "11px 14px",
                    border: `1.5px solid ${active ? "var(--pw-blue)" : "var(--pw-ink-200)"}`,
                    borderRadius: 12,
                    background: active ? "var(--pw-blue-50)" : "#fff",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{u.label}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {u.ref}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {units && units.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--low)" }}>{labels.noRecords}</p>
      )}

      {/* Manual fallback */}
      <details>
        <summary
          style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer" }}
        >
          {labels.manualSummary}
        </summary>
        <div style={{ marginTop: 8 }}>
          <input
            style={inputStyle}
            placeholder="9648812DF2894H0013RQ"
            value={manualRef}
            onChange={(e) => {
              setManualRef(e.target.value);
              setResolved(null);
            }}
          />
        </div>
      </details>

      {/* Asking price + optional buyer email / operator extras */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: withEmail || showExtras ? "1fr 1fr" : "1fr",
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle}>{labels.askingPrice}</label>
          <input name="askingPriceEur" inputMode="numeric" style={inputStyle} />
        </div>
        {withEmail && (
          <div>
            <label style={labelStyle}>{labels.email}</label>
            <input name="email" type="email" style={inputStyle} />
          </div>
        )}
        {showExtras && (
          <>
            <div>
              <label style={labelStyle}>Built m²</label>
              <input name="builtM2" inputMode="numeric" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Listing URL</label>
              <input name="listingUrl" style={inputStyle} />
            </div>
          </>
        )}
      </div>
      {withEmail && labels.emailHint ? (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>
          {labels.emailHint}
        </p>
      ) : null}

      {activeRef ? (
        <p style={{ fontSize: 14, color: "var(--good)", fontWeight: 600 }}>
          ✓ {labels.selected} <strong>{activeLabel}</strong>
        </p>
      ) : null}

      <button
        className="btn btn-primary"
        type="submit"
        disabled={!activeRef || submitting}
        style={{
          justifySelf: "start",
          opacity: activeRef && !submitting ? 1 : 0.5,
          cursor: activeRef && !submitting ? "pointer" : "default",
        }}
      >
        {submitting ? labels.finding : labels.submit}
      </button>
    </form>
  );
}
