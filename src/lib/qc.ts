import type { ReadingStatus, ValueType } from "../types";

/** "70.2, 69.8 70.5" → [70.2, 69.8, 70.5];  [] if blank;  null if any value isn't a number */
export function parseNumbers(s: string): number[] | null {
  const parts = s.split(/[,\s]+/).filter(Boolean);
  const nums = parts.map(Number);
  return nums.some((v) => Number.isNaN(v)) ? null : nums;
}

export function numericStatus(observed: string, min: number | null, max: number | null): ReadingStatus | "INVALID" {
  const nums = parseNumbers(observed);
  if (nums === null) return "INVALID";
  if (!nums.length) return "NA";
  return nums.every((v) => (min == null || v >= min) && (max == null || v <= max)) ? "PASS" : "FAIL";
}

export function formatSpec(p: {
  value_type: ValueType;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  target_value: string | null;
}) {
  if (p.value_type !== "NUMERIC") return p.target_value || (p.value_type === "PASS_FAIL" ? "Pass / Fail" : "Observation");
  const u = p.unit ? ` ${p.unit}` : "";
  if (p.min_value != null && p.max_value != null) return `${p.min_value} – ${p.max_value}${u}`;
  if (p.min_value != null) return `≥ ${p.min_value}${u}`;
  if (p.max_value != null) return `≤ ${p.max_value}${u}`;
  return p.target_value ? `${p.target_value}${u}` : `Record value${u ? ` (${p.unit})` : ""}`;
}

export const fmtDate = (d: string) => d.split("-").reverse().join("-"); // 2026-11-22 → 22-11-2026
export const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

// ---------- MRN QC status ----------
export type MrnQcStatus = "Pending QC" | "Partially Inspected" | "QC Completed";

export const mrnStatus = (m: { line_count: number; inspected_count: number }): MrnQcStatus =>
  m.inspected_count === 0 ? "Pending QC" : m.inspected_count < m.line_count ? "Partially Inspected" : "QC Completed";