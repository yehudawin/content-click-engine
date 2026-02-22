import { useState, useMemo } from "react";
import {
  BarChart3,
  ExternalLink,
  TrendingUp,
  Link2,
  RefreshCw,
  FolderKanban,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Download,
} from "lucide-react";
import { useGeneratedLinks, useUpdateLinkClicks, LinksFilter } from "@/hooks/useGeneratedLinks";
import { useSyncAnalytics } from "@/hooks/useDubApi";
import { Progress } from "@/components/ui/progress";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { CampaignChannelMatrix } from "@/components/CampaignChannelMatrix";
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
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { format, parseISO, startOfDay, eachDayOfInterval, subDays } from "date-fns";
import { he } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Analytics() {
  const [filters, setFilters] = useState<LinksFilter>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percent: 0 });

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
    const syncStartTime = Date.now();
    
    // Calculate batches for progress tracking (batch size = 2 in edge function)
    const batchSize = 2;
    const totalBatches = Math.ceil(linksWithDubId.length / batchSize);
    setSyncProgress({ current: 0, total: totalBatches, percent: 0 });
    
    // Simulate progress while waiting for the API
    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        const estimatedBatch = Math.min(prev.current + 1, totalBatches - 1);
        return {
          ...prev,
          current: estimatedBatch,
          percent: Math.round((estimatedBatch / totalBatches) * 90)
        };
      });
    }, 3000); // Matches batch processing time (2s delay + request time)
    
    try {
      const dubLinkIds = linksWithDubId.map((l) => l.dub_link_id!);
      
      // Build date params if filters are set
      const syncParams = {
        linkIds: dubLinkIds,
        startDate: filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : undefined,
        endDate: filters.dateTo ? `${filters.dateTo}T23:59:59Z` : undefined,
      };
      
      console.log('[Sync] Starting with params:', syncParams);
      
      const result = await syncAnalytics.mutateAsync(syncParams);
      
      clearInterval(progressInterval);
      setSyncProgress({ current: totalBatches, total: totalBatches, percent: 100 });
      
      console.log('[Sync] Response:', {
        successCount: result.meta.successCount,
        errorCount: result.meta.errorCount,
        requestId: result.meta.requestId,
      });

      // Update clicks in database - batch updates
      const updatePromises = linksWithDubId
        .filter(link => {
          const newClicks = result.data[link.dub_link_id!];
          // Only update if we got valid data (not undefined) and it's different
          return newClicks !== undefined && newClicks >= 0 && newClicks !== link.clicks;
        })
        .map(link => 
          updateClicks.mutateAsync({ 
            id: link.id, 
            clicks: result.data[link.dub_link_id!] 
          })
        );
      
      await Promise.all(updatePromises);
      
      const duration = ((Date.now() - syncStartTime) / 1000).toFixed(1);
      
      await refetch();
      
      if (result.meta.errorCount > 0) {
        toast.warning(`סונכרנו ${result.meta.successCount} לינקים, ${result.meta.errorCount} נכשלו (${duration}s)`);
      } else {
        toast.success(`הנתונים סונכרנו בהצלחה! (${result.meta.successCount} לינקים, ${duration}s)`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error syncing analytics:", error);
      toast.error("סנכרון הנתונים נכשל");
    }
    setIsSyncing(false);
    // Reset progress after a short delay to show 100%
    setTimeout(() => setSyncProgress({ current: 0, total: 0, percent: 0 }), 1000);
  };

  // Aggregate clicks by channel
  const channelStats = useMemo(() => {
    return links?.reduce(
      (acc, link) => {
        const channelName = link.channels?.name || "לא ידוע";
        const color = link.channels?.color || "#6366f1";

        if (!acc[channelName]) {
          acc[channelName] = { name: channelName, clicks: 0, count: 0, color };
        }
        acc[channelName].clicks += link.clicks || 0;
        acc[channelName].count += 1;
        return acc;
      },
      {} as Record<string, { name: string; clicks: number; count: number; color: string }>,
    );
  }, [links]);

  // Aggregate by campaign
  const campaignStats = useMemo(() => {
    return links?.reduce(
      (acc, link) => {
        const campaignName = link.campaigns?.name || "ללא קמפיין";

        if (!acc[campaignName]) {
          acc[campaignName] = { name: campaignName, clicks: 0, count: 0 };
        }
        acc[campaignName].clicks += link.clicks || 0;
        acc[campaignName].count += 1;
        return acc;
      },
      {} as Record<string, { name: string; clicks: number; count: number }>,
    );
  }, [links]);

  // Time-based data (clicks over time)
  const timeSeriesData = useMemo(() => {
    if (!links || links.length === 0) return [];

    // Get date range (last 30 days or from filter)
    const endDate = new Date();
    const startDate = filters.dateFrom ? parseISO(filters.dateFrom) : subDays(endDate, 30);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Group links by creation date
    const linksByDate = links.reduce(
      (acc, link) => {
        const date = format(parseISO(link.created_at), "yyyy-MM-dd");
        if (!acc[date]) {
          acc[date] = { links: 0, clicks: 0 };
        }
        acc[date].links += 1;
        acc[date].clicks += link.clicks || 0;
        return acc;
      },
      {} as Record<string, { links: number; clicks: number }>,
    );

    return days.map((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const data = linksByDate[dateKey] || { links: 0, clicks: 0 };
      return {
        date: format(day, "dd/MM", { locale: he }),
        fullDate: dateKey,
        links: data.links,
        clicks: data.clicks,
      };
    });
  }, [links, filters.dateFrom]);

  // Top performing links
  const topLinks = useMemo(() => {
    if (!links) return [];
    return [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5);
  }, [links]);

  const chartData = Object.values(channelStats || {}).sort((a, b) => b.clicks - a.clicks);
  const campaignData = Object.values(campaignStats || {}).sort((a, b) => b.clicks - a.clicks);
  const totalClicks = chartData.reduce((sum, item) => sum + item.clicks, 0);
  const totalLinks = links?.length || 0;
  const totalCampaigns = new Set(links?.map((l) => l.campaign_id).filter(Boolean)).size;
  const avgClicksPerLink = totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0;

  // Export to CSV
  const handleExport = () => {
    if (!links || links.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const headers = ["קמפיין", "ערוץ", "לינק קצר", "URL יעד", "קליקים", "תאריך יצירה"];
    const rows = links.map((link) => [
      link.campaigns?.name || "",
      link.channels?.name || "",
      link.short_link,
      link.destination_url,
      String(link.clicks || 0),
      new Date(link.created_at).toLocaleDateString("he-IL"),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ הורד בהצלחה");
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">לוח בקרה אנליטי</h1>
            <p className="text-muted-foreground">מעקב ביצועים מקיף בכל ערוצי ההפצה</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isLoading || !links?.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              ייצוא CSV
            </button>
            <button
              onClick={handleSyncClicks}
              disabled={isSyncing || isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              סנכרן נתונים
            </button>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {isSyncing && syncProgress.total > 0 && (
          <div className="mb-6 bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                מסנכרן נתונים...
              </span>
              <span className="text-sm text-muted-foreground">
                באצ׳ {syncProgress.current} מתוך {syncProgress.total} ({syncProgress.percent}%)
              </span>
            </div>
            <Progress value={syncProgress.percent} className="h-2" />
          </div>
        )}

        {/* Filters */}
        <AnalyticsFilters filters={filters} onFiltersChange={setFilters} />

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon={TrendingUp} label="סה״כ קליקים" value={totalClicks.toLocaleString()} color="primary" />
          <StatCard icon={Link2} label="סה״כ לינקים" value={totalLinks.toString()} color="accent" />
          <StatCard icon={BarChart3} label="ערוצים פעילים" value={chartData.length.toString()} color="info" />
          <StatCard
            icon={FolderKanban}
            label="ממוצע קליקים ללינק"
            value={avgClicksPerLink.toLocaleString()}
            color="warning"
          />
        </div>

        {/* Time Series Chart */}
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              מגמת קליקים לאורך זמן
            </h2>
          </div>

          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : timeSeriesData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={8} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      direction: "rtl",
                    }}
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name === "clicks" ? "קליקים" : "לינקים חדשים",
                    ]}
                    labelFormatter={(label) => `תאריך: ${label}`}
                  />
                  <Legend formatter={(value) => (value === "clicks" ? "קליקים" : "לינקים חדשים")} />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClicks)"
                  />
                  <Line type="monotone" dataKey="links" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
              <Calendar className="h-12 w-12 mb-3 opacity-50" />
              <p>אין נתונים עדיין</p>
            </div>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Channel Chart */}
          <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">קליקים לפי ערוץ</h2>

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
                      tickFormatter={(value) => (value.length > 12 ? `${value.slice(0, 12)}...` : value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        direction: "rtl",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toLocaleString()} קליקים (${props.payload.count} לינקים)`,
                        "",
                      ]}
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
                <p>אין נתונים עדיין</p>
              </div>
            )}
          </div>

          {/* Campaign Chart */}
          <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">קליקים לפי קמפיין</h2>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : campaignData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(value) => (value.length > 10 ? `${value.slice(0, 10)}...` : value)}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        direction: "rtl",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toLocaleString()} קליקים (${props.payload.count} לינקים)`,
                        "",
                      ]}
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

        {/* Campaign-Channel Matrix */}
        {links && links.length > 0 && (
          <div className="mb-8">
            <CampaignChannelMatrix links={links} />
          </div>
        )}

        {/* Top Performing Links */}
        <div className="bg-card rounded-xl border border-border shadow-sm mb-8">
          <div className="p-4 lg:p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              הלינקים המובילים
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : topLinks.length > 0 ? (
            <div className="divide-y divide-border">
              {topLinks.map((link, index) => (
                <div key={link.id} className="p-4 lg:px-6 flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: link.channels?.color || "#6366f1" }}
                      />
                      <span className="font-medium text-sm truncate">{link.channels?.name}</span>
                      {link.campaigns?.name && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {link.campaigns.name}
                        </span>
                      )}
                    </div>
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
                  </div>
                  <div className="text-left">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-accent/10 text-accent">
                      {(link.clicks || 0).toLocaleString()} קליקים
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>אין לינקים עדיין</p>
            </div>
          )}
        </div>

        {/* All Links Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">כל הלינקים</h2>
            <span className="text-sm text-muted-foreground">{totalLinks} לינקים</span>
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
                  {links.slice(0, 20).map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-sm text-muted-foreground">{link.campaigns?.name || "—"}</span>
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

// Stat Card Component
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "primary" | "accent" | "info" | "warning";
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 lg:p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
