import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatSvensktDatumTid, isoTillDatetimeLocal } from '../lib/tid'

// lib/tid.ts hade noll test (varken direkt eller indirekt — varken
// MaintenanceBannerAdmin.tsx eller AdminUppdateringar.tsx, de enda två
// konsumenterna, har en egen testfil). Nämnt uttryckligen i enhet-8 (avsnitt
// 5, sista stycket) som ogjort: "kräver TZ i konfigurationen". Projektet har
// redan haft en riktig produktionsincident kring UTC vs svensk sommartid
// (CLAUDE.md, session 36) — värt att låsa fast med en fast TZ, oberoende av
// vilken tidszon CI/utvecklarmaskinen råkar köra i.
beforeAll(() => {
  vi.stubEnv('TZ', 'Europe/Stockholm')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

describe('formatSvensktDatumTid', () => {
  it('formaterar UTC-vintertid till svensk lokal tid (CET, +1h)', () => {
    // 2026-01-15T10:30:00Z -> 11:30 lokal tid (CET)
    expect(formatSvensktDatumTid('2026-01-15T10:30:00Z')).toBe('tors 15 jan. 11:30')
  })

  it('formaterar UTC-sommartid till svensk lokal tid (CEST, +2h) — samma UTC-klockslag ger en annan lokal tid än på vintern', () => {
    // 2026-07-15T10:30:00Z -> 12:30 lokal tid (CEST)
    expect(formatSvensktDatumTid('2026-07-15T10:30:00Z')).toBe('ons 15 juli 12:30')
  })

  it('en tid nära midnatt kan hoppa till nästa dag lokalt', () => {
    // 2026-03-01T23:15:00Z -> 2026-03-02 00:15 lokal tid (CET, +1h)
    expect(formatSvensktDatumTid('2026-03-01T23:15:00Z')).toBe('mån 2 mars 00:15')
  })
})

describe('isoTillDatetimeLocal', () => {
  it('konverterar en UTC-tidsstämpel till datetime-local-formatet (vintertid, CET)', () => {
    expect(isoTillDatetimeLocal('2026-01-15T10:30:00Z')).toBe('2026-01-15T11:30')
  })

  it('konverterar en UTC-tidsstämpel till datetime-local-formatet (sommartid, CEST)', () => {
    expect(isoTillDatetimeLocal('2026-07-15T10:30:00Z')).toBe('2026-07-15T12:30')
  })

  it('nollpaddar ensiffriga månad/dag/timme/minut', () => {
    // 2026-01-05T07:05:00Z -> 08:05 lokal tid (CET) samma dag
    expect(isoTillDatetimeLocal('2026-01-05T07:05:00Z')).toBe('2026-01-05T08:05')
  })

  it('går att mata rakt in i formatSvensktDatumTid-liknande dygnsgräns utan att tappa ett håll', () => {
    // 2026-12-31T23:30:00Z -> 2027-01-01 00:30 lokal tid (CET) — årsskifte
    expect(isoTillDatetimeLocal('2026-12-31T23:30:00Z')).toBe('2027-01-01T00:30')
  })
})
