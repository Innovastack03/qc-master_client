import { MasterTable } from "../components/MasterTable";
import { useMasterStore } from "../store/masterStore";

export function MastersPage() {
  const uoms = useMasterStore((s) => s.uoms);
  const processes = useMasterStore((s) => s.processes);

  return (
    <div className="space-y-6">
      <h1 className="page-title">UOM & Processes</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <MasterTable title="Units of Measure" resource="uoms" rows={uoms}
          fields={[
            { key: "code", label: "Code", required: true, placeholder: "KG" },
            { key: "name", label: "Name", required: true, placeholder: "Kilogram" },
          ]} />
        <MasterTable title="In-Process Stages" resource="processes" rows={processes}
          fields={[
            { key: "name", label: "Process", required: true },
            { key: "seq", label: "Sequence", type: "number" },
          ]} />
      </div>
    </div>
  );
}