/**
 * ResolutionOptions
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. The two Resolution Wizard steps
 *   that aren't populated from case data — Motive and Timeline — need a
 *   fixed vocabulary so a solution.json's `motive`/`timeline` values mean
 *   the same thing across every case. Kept here as the single source of
 *   truth for both the wizard UI and anything that reads solution.json.
 *
 * Rules:
 *   Generic to CID OS, not to any one case — a case's solution.json picks
 *   from these ids, it never invents its own.
 */

export const MOTIVE_OPTIONS = [
    { id: 'financial',    label: 'Financial Gain' },
    { id: 'theft',         label: 'Theft' },
    { id: 'revenge',       label: 'Revenge' },
    { id: 'jealousy',      label: 'Jealousy' },
    { id: 'coverup',       label: 'Cover-Up' },
    { id: 'self-defense', label: 'Self-Defense' },
    { id: 'unknown',       label: 'Unknown / Unclear' },
];

export const TIMELINE_OPTIONS = [
    { id: 'before-2100', label: 'Before 21:00' },
    { id: '2100-2145',    label: '21:00 – 21:45' },
    { id: '2145-2215',    label: '21:45 – 22:15' },
    { id: 'after-2215',   label: 'After 22:15' },
];

export default { MOTIVE_OPTIONS, TIMELINE_OPTIONS };
