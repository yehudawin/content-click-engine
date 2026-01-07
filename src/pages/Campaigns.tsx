import { useState } from "react";
import { Plus, Trash2, Loader2, FolderKanban, Link2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from "@/hooks/useCampaigns";
import { useGeneratedLinks } from "@/hooks/useGeneratedLinks";
import { CampaignSchema } from "@/lib/validation";

export default function Campaigns() {
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDescription, setNewCampaignDescription] = useState("");

  const { data: campaigns, isLoading } = useCampaigns();
  const { data: allLinks } = useGeneratedLinks();
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const getCampaignStats = (campaignId: string) => {
    const campaignLinks = allLinks?.filter((l) => l.campaign_id === campaignId) || [];
    const totalClicks = campaignLinks.reduce((sum, l) => sum + (l.clicks || 0), 0);
    return { links: campaignLinks.length, clicks: totalClicks };
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input before submission
    const result = CampaignSchema.safeParse({
      name: newCampaignName.trim(),
      description: newCampaignDescription.trim() || undefined,
    });

    if (!result.success) {
      toast.error(result.error.errors[0]?.message || "קלט לא תקין");
      return;
    }

    try {
      await createCampaign.mutateAsync({
        name: result.data.name,
        description: result.data.description,
      });
      toast.success("הקמפיין נוצר בהצלחה!");
      setNewCampaignName("");
      setNewCampaignDescription("");
    } catch (error: any) {
      toast.error(error.message || "יצירת הקמפיין נכשלה");
    }
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(`למחוק את הקמפיין "${name}"? הלינקים המשויכים יישארו ללא קמפיין.`)) {
      return;
    }

    try {
      await deleteCampaign.mutateAsync(id);
      toast.success("הקמפיין נמחק בהצלחה");
    } catch (error) {
      toast.error("מחיקת הקמפיין נכשלה");
    }
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            ניהול קמפיינים
          </h1>
          <p className="text-muted-foreground">
            צרו וניהלו פרויקטי פרסום
          </p>
        </div>

        {/* Add Campaign Form */}
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            קמפיין חדש
          </h2>

          <form onSubmit={handleAddCampaign} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                שם הקמפיין
              </label>
              <input
                type="text"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="לדוגמה: השקת מוצר חדש, קמפיין חגים..."
                maxLength={100}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {newCampaignName.length}/100 תווים
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                תיאור (אופציונלי)
              </label>
              <textarea
                value={newCampaignDescription}
                onChange={(e) => setNewCampaignDescription(e.target.value)}
                placeholder="תיאור קצר של הקמפיין..."
                rows={2}
                maxLength={500}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {newCampaignDescription.length}/500 תווים
              </p>
            </div>

            <button
              type="submit"
              disabled={createCampaign.isPending}
              className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createCampaign.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              צור קמפיין
            </button>
          </form>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            הקמפיינים שלכם
          </h2>

          {isLoading ? (
            <div className="bg-card rounded-xl border border-border p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => {
                const stats = getCampaignStats(campaign.id);
                return (
                  <div
                    key={campaign.id}
                    className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FolderKanban className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {campaign.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                        disabled={deleteCampaign.isPending}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex gap-4 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                        <span>{stats.links} לינקים</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        <span>{stats.clicks.toLocaleString()} קליקים</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                      נוצר ב-{new Date(campaign.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>אין קמפיינים עדיין. צרו את הקמפיין הראשון שלכם למעלה!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
