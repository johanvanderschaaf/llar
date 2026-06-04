"use client";

import { useEffect, useRef, useState } from "react";
import { createReportAction } from "@/app/admin/actions";

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

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid var(--line-2)",
  borderRadius: 10,
  font: "inherit",
  width: "100%",
} as const;
const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--ink-soft)",
  marginBottom: 4,
  display: "block",
} as const;

export function NewReportForm() {
  const [query, setQuery] = useState("");
  const [streets, setStreets] = useState<Street[]>([]);
  const [showList, setShowList] = useState(false);
  const [street, setStreet] = useState<Street | null>(null);
  const [number, setNumber] = useState("");
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [resolved, setResolved] = useState<Unit | null>(null);
  const [manualRef, setManualRef] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced street autocomplete.
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
    <form action={createReportAction} style={{ display: "grid", gap: 18 }}>
      {/* Hidden values consumed by the server action */}
      <input type="hidden" name="cadastralRef" value={activeRef} />
      <input type="hidden" name="addressOrRef" value={activeLabel} />

      {/* Street autocomplete */}
      <div style={{ position: "relative" }}>
        <label style={labelStyle}>Street (Barcelona)</label>
        <input
          style={inputStyle}
          placeholder="Start typing, e.g. Sors"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setStreet(null);
          }}
          onFocus={() => streets.length && setShowList(true)}
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
              border: "1px solid var(--line-2)",
              borderRadius: 10,
              marginTop: 4,
              boxShadow: "var(--shadow)",
              maxHeight: 220,
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
                  padding: "9px 12px",
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
        <div style={{ width: 140 }}>
          <label style={labelStyle}>Number</label>
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
          className="lang-toggle"
          onClick={findUnits}
          disabled={!street || !number.trim() || loadingUnits}
          style={{ cursor: "pointer", padding: "10px 16px" }}
        >
          {loadingUnits ? "Searching…" : "Find units"}
        </button>
      </div>

      {/* Unit results */}
      {units && units.length > 0 && (
        <div>
          <label style={labelStyle}>Select the unit</label>
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
                    padding: "10px 12px",
                    border: `1px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                    borderRadius: 10,
                    background: active ? "var(--ok-bg)" : "#fff",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{u.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {u.ref}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {units && units.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--low)" }}>
          No Catastro records at that street/number. Check the number, or enter a
          cadastral reference manually below.
        </p>
      )}

      {/* Manual fallback */}
      <details>
        <summary
          style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer" }}
        >
          Or enter a cadastral reference directly
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

      {/* Optional details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Asking price (€)</label>
          <input name="askingPriceEur" inputMode="numeric" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Listing URL</label>
          <input name="listingUrl" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Built m²</label>
          <input name="builtM2" inputMode="numeric" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Usable m²</label>
          <input name="usableM2" inputMode="numeric" style={inputStyle} />
        </div>
      </div>

      {activeRef ? (
        <p style={{ fontSize: 13, color: "var(--good)" }}>
          ✓ Selected: <strong>{activeLabel}</strong>
        </p>
      ) : null}

      <button
        className="badge-plan"
        type="submit"
        disabled={!activeRef}
        style={{
          cursor: activeRef ? "pointer" : "default",
          padding: "11px 16px",
          justifySelf: "start",
          opacity: activeRef ? 1 : 0.5,
        }}
      >
        Generate report →
      </button>
    </form>
  );
}
