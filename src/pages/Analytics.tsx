import { useState, useEffect } from "react";
import { BarChart3, ExternalLink, TrendingUp, Link2, RefreshCw, FolderKanban } from "lucide-react";
import { useGeneratedLinks, useUpdateLinkClicks, LinksFilter } from "@/hooks/useGeneratedLinks";
import { useSyncAnalytics } from "@/hooks/useDubApi";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export default function Analytics() {
  const [filters, setFilters] = useState<LinksFilter>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: links, isLoading, refetch } = useGeneratedLinks(filters);
  const syncAnalytics = useSyncAnalytics();
  const updateClicks = useUpdateLinkClicks();

  // Sync clicks from Dub.co
  const handleSyncClicks = async () => {
    if (!links || links.length === 0) return;

    const linksWithDubId = links.filter((l) => l.dub_link_id);
    if (linksWithDubId.length === 0) {
      toast.info("אין לינקים לסנכרון");
      return;
    }

    setIsSyncing(true);
    try {
      const dubLinkIds = linksWithDubId.map((l) => l.dub_link_id!);
      const clicksData = await syncAnalytics.mutateAsync(dubLinkIds);

      // Update each link's clicks in the database
      for (const link of linksWithDubId) {
        const newClicks = clicksData[link.dub_link_id!] || 0;
        if (newClicks !== link.clicks) {
          await updateClicks.mutateAsync({ id: link.id, clicks: newClicks });
        }
      }

      await refetch();
      toast.success("הנתונים סונכרנו בהצלחה!");
    } catch (error) {
      console.error("Error syncing analytics:", error);
      toast.error("סנכרון הנתונים נכשל");
    }
    setIsSyncing(false);
  };

  // Aggregate clicks by channel
  const channelStats = links?.reduce((acc, link) => {
    const channelName = link.channels?.name || "לא ידוע";
    const color = link.channels?.color || "#6366f1";
    
    if (!acc[channelName]) {
      acc[channelName] = { name: channelName, clicks: 0, count: 0, color };
    }
    acc[channelName].clicks += link.clicks || 0;
    acc[channelName].count += 1;
    return acc;
  }, {} as Record<string, { name: string; clicks: number; count: number; color: string }>);

  // Aggregate by campaign
  const campaignStats = links?.reduce((acc, link) => {
    const campaignName = link.campaigns?.name || "ללא קמפיין";
    
    if (!acc[campaignName]) {
      acc[campaignName] = { name: campaignName, clicks: 0, count: 0 };
    }
    acc[campaignName].clicks += link.clicks || 0;
    acc[campaignName].count += 1;
    return acc;
  }, {} as Record<string, { name: string; clicks: number; count: number }>);

  const chartData = Object.values(channelStats || {});
  const campaignData = Object.values(campaignStats || {});
  const totalClicks = chartData.reduce((sum, item) => sum + item.clicks, 0);
  const totalLinks = links?.length || 0;
  const totalCampaigns = new Set(links?.map((l) => l.campaign_id).filter(Boolean)).size;

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              לוח בקרה אנליטי
            </h1>
            <p className="text-muted-foreground">
              מעקב ביצועים בכל ערוצי ההפצה
            </p>
          </div>
          <button
            onClick={handleSyncClicks}
            disabled={isSyncing || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            סנכרן נתונים
          </button>
        </div>

        {/* Filters */}
        <AnalyticsFilters filters={filters} onFiltersChange={setFilters} />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">סה״כ קליקים</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalClicks.toLocaleString()}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">סה״כ לינקים</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalLinks}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-info" />
              </div>
              <span className="text-sm text-muted-foreground">ערוצים פעילים</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{chartData.length}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <FolderKanban className="h-5 w-5 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">קמפיינים</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalCampaigns}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Channel Chart */}
          <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              קליקים לפי ערוץ
            </h2>
            
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value.toLocaleString(), "קליקים"]}
                    />
                    <Bar dataKey="clicks" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-3 opacity-50" />
                <p>אין נתונים עדיין. צרו לינקים כדי לראות אנליטיקס!</p>
              </div>
            )}
          </div>

          {/* Campaign Chart */}
          <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              קליקים לפי קמפיין
            </h2>
            
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : campaignData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value.toLocaleString(), "קליקים"]}
                    />
                    <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <FolderKanban className="h-12 w-12 mb-3 opacity-50" />
                <p>אין נתונים עדיין</p>
              </div>
            )}
          </div>
        </div>

        {/* Links Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">לינקים אחרונים</h2>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : links && links.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      קמפיין
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      ערוץ
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      לינק קצר
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      תאריך יצירה
                    </th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      קליקים
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {links.slice(0, 15).map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-sm text-muted-foreground">
                          {link.campaigns?.name || "—"}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: link.channels?.color || "#6366f1" }}
                          />
                          <span className="font-medium text-sm">{link.channels?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <a
                          href={link.short_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                          dir="ltr"
                        >
                          {link.short_link}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                        {new Date(link.created_at).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-left">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {link.clicks?.toLocaleString() || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>אין לינקים עדיין.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
