// ---------- QC stages ----------
export const STAGES = [
  { key: "IQC", label: "IQC – Incoming Quality Check", short: "IQC", flag: "qc_iqc" },
  { key: "IN_PROCESS", label: "In-Process Quality Check", short: "IPQC", flag: "qc_inprocess" },
  { key: "AQL", label: "Acceptance Sampling Inspection (AQL)", short: "AQL", flag: "qc_aql" },
  { key: "PDI", label: "PDI – Pre-Dispatch Inspection", short: "PDI", flag: "qc_pdi" },
] as const;

export type Stage = (typeof STAGES)[number]["key"];
export type StageFlag = (typeof STAGES)[number]["flag"];
export type ValueType = "NUMERIC" | "TEXT" | "PASS_FAIL";

// ---------- Masters ----------
/** Category, e.g. Raw Material (table: item_groups) */
export type Group = { id: number; name: string };
/** Sub-category / Material, e.g. Paper (table: categories) */
export type Category = { id: number; group_id: number; name: string };
export type Uom = { id: number; code: string; name: string };
export type Process = { id: number; name: string; seq: number };

export type QcParameter = {
  id: number;
  name: string;
  stage: Stage;
  category_id: number | null;
  process_id: number | null;
  value_type: ValueType;
  unit: string | null;
  default_min: number | null;
  default_max: number | null;
  test_method: string | null;
  active: number;
  category_name: string | null;
  process_name: string | null;
};

export type Vendor = {
  id: number;
  code: string;
  name: string;
  gstin: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  active: number;
};

// ---------- Items (material grades) ----------
export type ItemRecord = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  group_id: number;
  category_id: number;
  uom_id: number;
  pack_units: number | null;
  hsn_code: string | null;
  qc_iqc: number;
  qc_inprocess: number;
  qc_aql: number;
  qc_pdi: number;
  aql_level: string | null;
  aql_critical: number | null;
  aql_major: number | null;
  aql_minor: number | null;
  group_name: string;
  category_name: string;
  uom_code: string;
  spec_count?: number;
};

export type ItemSpecDetail = {
  parameter_id: number;
  min_value: number | null;
  max_value: number | null;
  target_value: string | null;
  mandatory: number;
};

export type ItemDetail = ItemRecord & { specs: ItemSpecDetail[] };

export type ItemPayload = {
  code: string | null;
  name: string;
  description: string | null;
  group_id: number;
  category_id: number;
  uom_id: number;
  pack_units: number | null;
  hsn_code: string;
  qc_iqc: boolean;
  qc_inprocess: boolean;
  qc_aql: boolean;
  qc_pdi: boolean;
  aql_level: string | null;
  aql_critical: number | null;
  aql_major: number | null;
  aql_minor: number | null;
  specs: {
    parameter_id: number;
    min_value: number | null;
    max_value: number | null;
    target_value: string | null;
    mandatory: boolean;
  }[];
};

// ---------- Results ----------
export type IqcResult = "ACCEPTED" | "ACCEPTED_WITH_DEVIATION" | "REJECTED" | "ON_HOLD";
export type ReadingStatus = "PASS" | "FAIL" | "NA";

export const RESULT_LABEL: Record<IqcResult, string> = {
  ACCEPTED: "Accepted",
  ACCEPTED_WITH_DEVIATION: "Accepted with Deviation",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
};

// ---------- Material Receipt Note ----------
export type MrnLine = {
  id: number;
  mrn_id: number;
  line_no: number;
  sub_category_id: number;
  item_id: number | null;
  uom_id: number | null;
  lot_no: string | null;
  packages: number | null;
  received_qty: number;
  remarks: string | null;
  sub_category_name: string;
  category_name: string;
  item_name: string | null;
  item_code: string | null;
  uom_code: string | null;
  inspection_id: number | null;
  inspection_no: string | null;
  inspection_result: IqcResult | null;
};

export type MrnRecord = {
  id: number;
  mrn_no: string;
  mrn_date: string;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  invoice_no: string;
  invoice_date: string | null;
  po_no: string | null;
  vehicle_no: string | null;
  received_by: string | null;
  remarks: string | null;
  line_count: number;
  inspected_count: number;
};

export type MrnDetail = MrnRecord & { lines: MrnLine[] };

export type MrnPayload = {
  mrn_date: string;
  vendor_id: number;
  invoice_no: string;
  invoice_date: string | null;
  po_no: string | null;
  vehicle_no: string | null;
  received_by: string | null;
  remarks: string | null;
  lines: {
    id: number | null;
    sub_category_id: number;
    item_id: number | null;
    uom_id: number | null;
    lot_no: string | null;
    packages: number | null;
    received_qty: number;
    remarks: string | null;
  }[];
};

export type PendingLine = {
  id: number;
  line_no: number;
  received_qty: number;
  lot_no: string | null;
  mrn_id: number;
  mrn_no: string;
  mrn_date: string;
  vendor_name: string;
  material_name: string;
  sub_category_name: string;
  uom_code: string | null;
};

// ---------- Incoming Quality Check ----------
export type ChecklistParam = {
  parameter_id: number;
  name: string;
  unit: string | null;
  value_type: ValueType;
  test_method: string | null;
  min_value: number | null;
  max_value: number | null;
  target_value: string | null;
  mandatory: number;
};

export type Checklist = { source: "item" | "template"; parameters: ChecklistParam[] };

export type IqcRecord = {
  id: number;
  inspection_no: string;
  inspection_date: string;
  mrn_line_id: number | null;
  mrn_id: number | null;
  mrn_no: string | null;
  mrn_date: string | null;
  mrn_line_no: number | null;
  invoice_no: string | null;
  invoice_date: string | null;
  sub_category_id: number;
  item_id: number | null;
  item_code: string | null;
  item_name: string;
  grade_name: string | null;
  category_name: string;
  sub_category_name: string;
  uom_id: number | null;
  uom_code: string | null;
  vendor_id: number | null;
  vendor_name: string | null;
  lot_no: string | null;
  packages: number | null;
  received_qty: number | null;
  sample_size: number | null;
  accepted_qty: number | null;
  rejected_qty: number | null;
  result: IqcResult;
  inspected_by: string | null;
  remarks: string | null;
  fail_count: number;
};

export type IqcReading = {
  id: number;
  parameter_id: number;
  parameter_name: string;
  unit: string | null;
  value_type: ValueType;
  min_value: number | null;
  max_value: number | null;
  target_value: string | null;
  observed: string | null;
  status: ReadingStatus;
  remarks: string | null;
};

export type IqcDetail = IqcRecord & { readings: IqcReading[] };

export type IqcPayload = {
  mrn_line_id: number;
  inspection_date: string;
  sample_size: number | null;
  accepted_qty: number | null;
  rejected_qty: number | null;
  result: IqcResult;
  inspected_by: string | null;
  remarks: string | null;
  readings: { parameter_id: number; observed: string | null; status: ReadingStatus; remarks: string | null }[];
};