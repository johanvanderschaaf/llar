import { afterEach, describe, expect, it, vi } from "vitest";
import { CatastroDownError, isCatastroOutage } from "./catastro-outage";
import { locateUnits, searchStreets } from "./catastro-search";

// The exact maintenance answer Catastro gave on 2026-11-18 (HTTP 200).
const MAINTENANCE = `<consulta_callejero><control><cuerr>1</cuerr></control><lerr><err><cod>0</cod>
<des>problemas tecnicos. Tiempo estimado desde las 15.15H hasta las 19.00.H.

Disculpe las molestias.</des></err></lerr></consulta_callejero>`;
const NO_RECORD_DNP = `<consulta_dnp><control><cuerr>1</cuerr></control><lerr><err><cod>43</cod>
<des>EL NUMERO NO EXISTE</des></err></lerr></consulta_dnp>`;

describe("isCatastroOutage", () => {
  it("recognises maintenance messages", () => {
    expect(isCatastroOutage("problemas tecnicos. Tiempo estimado desde las 15.15H")).toBe(true);
    expect(isCatastroOutage("Servicio no disponible")).toBe(true);
  });
  it("does not mistake a missing record for an outage", () => {
    expect(isCatastroOutage("EL NUMERO NO EXISTE")).toBe(false);
    expect(isCatastroOutage("LA REFERENCIA CATASTRAL NO EXISTE")).toBe(false);
    expect(isCatastroOutage(undefined)).toBe(false);
  });
});

describe("Catastro address search during an outage", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (body: string, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

  it("throws CatastroDownError on a maintenance answer", async () => {
    respond(MAINTENANCE);
    await expect(searchStreets("Mallorca")).rejects.toBeInstanceOf(CatastroDownError);
  });

  it("throws CatastroDownError on an HTTP error or network failure", async () => {
    respond("", 503);
    await expect(locateUnits("CL", "SORS", "35")).rejects.toBeInstanceOf(CatastroDownError);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(searchStreets("Sors")).rejects.toBeInstanceOf(CatastroDownError);
  });

  it("still returns no results for a number that doesn't exist", async () => {
    respond(NO_RECORD_DNP);
    await expect(locateUnits("CL", "SORS", "999")).resolves.toEqual([]);
  });
});
