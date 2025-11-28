import { useState } from "react";
import { IndustryList } from "./IndustryList";
import { MaterialList } from "./MaterialList";

export function InventoryDashboard() {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <IndustryList
          selectedIndustryId={selectedIndustryId}
          onSelectIndustry={setSelectedIndustryId}
        />
      </div>
      <div className="lg:col-span-3">
        <MaterialList selectedIndustryId={selectedIndustryId} />
      </div>
    </div>
  );
}
