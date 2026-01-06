import { Plus, FolderKanban } from "lucide-react";
import { useCampaigns, useCreateCampaign } from "@/hooks/useCampaigns";
import { useState } from "react";
import { toast } from "sonner";

interface CampaignSelectorProps {
  selectedCampaign: string | null;
  onSelect: (id: string | null) => void;
}

export function CampaignSelector({ selectedCampaign, onSelect }: CampaignSelectorProps) {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("נא להזין שם קמפיין");
      return;
    }

    try {
      const created = await createCampaign.mutateAsync({ name: newName.trim() });
      onSelect(created.id);
      setNewName("");
      setShowNewInput(false);
      toast.success("קמפיין נוצר בהצלחה!");
    } catch (error) {
      toast.error("יצירת הקמפיין נכשלה");
    }
  };

  if (isLoading) {
    return <div className="h-12 rounded-lg bg-muted animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        קמפיין פרסום
      </label>

      <div className="flex flex-wrap gap-2">
        {campaigns?.map((campaign) => (
          <button
            key={campaign.id}
            type="button"
            onClick={() => onSelect(selectedCampaign === campaign.id ? null : campaign.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
              selectedCampaign === campaign.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            <span className="text-sm font-medium">{campaign.name}</span>
          </button>
        ))}

        {!showNewInput && (
          <button
            type="button"
            onClick={() => setShowNewInput(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">קמפיין חדש</span>
          </button>
        )}
      </div>

      {showNewInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="שם הקמפיין..."
            className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={createCampaign.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            צור
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewInput(false);
              setNewName("");
            }}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}
