import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { X, Users } from "lucide-react";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ResponsiblesSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ResponsiblesSelector({ selectedIds, onChange }: ResponsiblesSelectorProps) {
  const { selectedCompanyId } = useCompany();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const fetchProfiles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("company_id", selectedCompanyId)
        .eq("is_active", true)
        .order("first_name");
      
      if (data) setProfiles(data);
      setLoading(false);
    };

    fetchProfiles();
  }, [selectedCompanyId]);

  const toggleProfile = (profileId: string) => {
    if (selectedIds.includes(profileId)) {
      onChange(selectedIds.filter(id => id !== profileId));
    } else {
      onChange([...selectedIds, profileId]);
    }
  };

  const removeProfile = (profileId: string) => {
    onChange(selectedIds.filter(id => id !== profileId));
  };

  const getProfileName = (profile: Profile) => {
    const firstName = profile.first_name || "";
    const lastName = profile.last_name || "";
    return `${firstName} ${lastName}`.trim() || "Usuário";
  };

  const selectedProfiles = profiles.filter(p => selectedIds.includes(p.id));

  return (
    <Card className="p-4 space-y-3">
      {selectedProfiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProfiles.map(profile => (
            <Badge key={profile.id} variant="secondary" className="gap-1">
              {getProfileName(profile)}
              <button
                type="button"
                onClick={() => removeProfile(profile.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Carregando...
        </p>
      ) : profiles.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <ScrollArea className="h-40">
          <div className="space-y-2">
            {profiles.map(profile => (
              <label
                key={profile.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.includes(profile.id)}
                  onCheckedChange={() => toggleProfile(profile.id)}
                />
                <span className="text-sm">{getProfileName(profile)}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
