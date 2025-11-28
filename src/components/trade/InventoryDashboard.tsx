import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndustryList } from "./IndustryList";
import { MaterialList } from "./MaterialList";
import { MovementHistory } from "./MovementHistory";
import { Package, History } from "lucide-react";

export function InventoryDashboard() {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="estoque" className="w-full">
        <TabsList>
          <TabsTrigger value="estoque" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Estoque Atual
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="mt-6">
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
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <IndustryList
                selectedIndustryId={selectedIndustryId}
                onSelectIndustry={setSelectedIndustryId}
              />
            </div>
            <div className="lg:col-span-3">
              <MovementHistory selectedIndustryId={selectedIndustryId} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
