import type { MrnQcStatus } from "../lib/qc";
import { RESULT_LABEL, type IqcResult, type ReadingStatus } from "../types";

const STATUS: Record<ReadingStatus | "INVALID", [string, string]> = {
  PASS: ["bg-emerald-100 text-emerald-700", "Pass"],
  FAIL: ["bg-red-100 text-red-700", "Fail"],
  NA: ["bg-slate-100 text-slate-500", "Not checked"],
  INVALID: ["bg-amber-100 text-amber-700", "Invalid"],
};

const RESULT: Record<IqcResult, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  ACCEPTED_WITH_DEVIATION: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-slate-200 text-slate-700",
};

const MRN: Record<MrnQcStatus, string> = {
  "Pending QC": "bg-amber-100 text-amber-700",
  "Partially Inspected": "bg-blue-100 text-blue-700",
  "QC Completed": "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({ status }: { status: ReadingStatus | "INVALID" }) {
  const [cls, label] = STATUS[status];
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export function ResultBadge({ result, large }: { result: IqcResult; large?: boolean }) {
  return (
    <span className={`inline-block rounded-sm font-semibold ${RESULT[result]} ${large ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[11px]"}`}>
      {RESULT_LABEL[result]}
    </span>
  );
}

export function MrnStatusBadge({ status }: { status: MrnQcStatus }) {
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${MRN[status]}`}>{status}</span>;
}