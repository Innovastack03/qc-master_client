import { MasterTable } from "../components/MasterTable";
import { useMasterStore } from "../store/masterStore";

export function VendorsPage() {
  const vendors = useMasterStore((s) => s.vendors);
  return (
    <div className="space-y-6">
      <h1 className="page-title">Procurement · Vendors</h1>
      <MasterTable
        title="Vendor Master"
        resource="vendors"
        rows={vendors}
        fields={[
          { key: "code", label: "Vendor Code", required: true },
          { key: "name", label: "Vendor Name", required: true },
          { key: "gstin", label: "GSTIN", placeholder: "36ABCDE1234F1Z5" },
          { key: "contact_person", label: "Contact Person" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "address", label: "Address", hideInTable: true },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "pincode", label: "Pincode", hideInTable: true },
          { key: "active", label: "Active", type: "checkbox" },
        ]}
      />
    </div>
  );
}