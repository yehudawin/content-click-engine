import { useState, useMemo } from "react";
import {
  BarChart3,
  ExternalLink,
  TrendingUp,
  Link2,
  RefreshCw,
  FolderKanban,
  Calendar,
  Download,
  CheckCircle2,
  AlertCircle,
  MousePointerClick,
  Trophy,
  Flame,
  Zap,
  Search,
  Target,
  Sparkles,
  Activity,
} from "lucide-react";
import { useGeneratedLinks, LinksFilter } from "@/hooks/useGeneratedLinks";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { CampaignChannelMatrix } from "@/components/CampaignChannelMatrix";
import { InsightCard } from "@/components/InsightCard";
import { SmartInsights } from "@/components/SmartInsights";
import { toast } from "sonner";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { format, parseISO, eachDayOfInterval, subDays, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 25;
const PIE_PALETTE = [
  "hsl(239 84% 67%)",
  "hsl(160 84% 39%)",
  "hsl(217 91% 60%)",
  "hsl(38 92% 50%)",
  "hsl(280 84% 60%)",
  "hsl(340 82% 60%)",
  "hsl(180 84% 45%)",
  "hsl(25 95% 55%)",
];

export default function Analytics() {
  const [filters, setFilters] = useState<LinksFilter>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [page, setPage] = useState(0);
  const [tableSearch, setTableSearch] = useState("");

  const { data: links, isLoading, refetch } = useGeneratedLinks(filters);
  const { data: syncStatus } = useSyncStatus();

  const handleSyncClicks = async () => {
    if (!links || links.length === 0) return;
    const linksWithDubId = links.filter((l) => l.dub_link_id);
    if (linksWithDubId.length === 0) {
      toast.info("אין לינקים לסנכרון");
      return;
    }

    setIsSyncing(true);
    const syncStartTime = Date.now();
    setSyncProgress({ current: 0, total: linksWithDubId.length, percent: 5 });

    try {
      supabase.functions
        .invoke("sync-analytics", { body: {} })
        .catch((err) => console.warn("[Sync] background invoke error:", err));

      toast.info("הסנכרון התחיל ברקע, זה עשוי לקחת כמה דקות...");

      const maxAttempts = 60;
      let attempts = 0;
      let finalStatus: string | null = null;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;

        const { data: status } = await supabase
          .from("analytics_sync_status")
          .select("*")
          .eq("id", true)
          .maybeSingle();

        if (status) {
          const synced = status.synced_links ?? 0;
          const total = linksWithDubId.length;
          setSyncProgress({
            current: synced,
            total,
            percent: Math.min(95, Math.round((synced / total) * 100)),
          });

          if (status.status === "completed" || status.status === "failed") {
            finalStatus = status.status;
            const duration = ((Date.now() - syncStartTime) / 1000).toFixed(1);
            await refetch();
            setSyncProgress({ current: total, total, percent: 100 });

            if (status.status === "completed") {
              toast.success(`סנכרון הושלם! (${status.success_count} לינקים, ${duration}s)`);
            } else {
              toast.error(status.message || "הסנכרון נכשל");
            }
            break;
          }
        }
      }

      if (!finalStatus) {
        toast.warning("הסנכרון עדיין רץ ברקע. רענן בעוד דקה.");
        await refetch();
      }
    } catch (error) {
      console.error("Error syncing analytics:", error);
      toast.error("סנכרון הנתונים נכשל");
    }
    setIsSyncing(false);
    setTimeout(() => setSyncProgress({ current: 0, total: 0, percent: 0 }), 1000);
  };

  // ===== Aggregations =====
  const channelStats = useMemo(() => {
    const acc: Record<string, { name: string; clicks: number; count: number; color: string }> = {};
    links?.forEach((link) => {
      const name = link.channels?.name || "לא ידוע";
      const color = link.channels?.color || "#6366f1";
      if (!acc[name]) acc[name] = { name, clicks: 0, count: 0, color };
      acc[name].clicks += link.clicks || 0;
      acc[name].count += 1;
    });
    return acc;
  }, [links]);

  const campaignStats = useMemo(() => {
    const acc: Record<string, { name: string; clicks: number; count: number }> = {};
    links?.forEach((link) => {
      const name = link.campaigns?.name || "ללא קמפיין";
      if (!acc[name]) acc[name] = { name, clicks: 0, count: 0 };
      acc[name].clicks += link.clicks || 0;
      acc[name].count += 1;
    });
    return acc;
  }, [links]);

  // Time series — last 30 days
  const { timeSeriesData, recent7Clicks, prev7Clicks } = useMemo(() => {
    if (!links || links.length === 0)
      return { timeSeriesData: [] as any[], recent7Clicks: 0, prev7Clicks: 0 };

    const endDate = new Date();
    const startDate = filters.dateFrom ? parseISO(filters.dateFrom) : subDays(endDate, 29);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const byDate = links.reduce(
      (acc, link) => {
        const date = format(parseISO(link.created_at), "yyyy-MM-dd");
        if (!acc[date]) acc[date] = { links: 0, clicks: 0 };
        acc[date].links += 1;
        acc[date].clicks += link.clicks || 0;
        return acc;
      },
      {} as Record<string, { links: number; clicks: number }>,
    );

    // Cumulative clicks: total clicks accumulated by all links created up to & including each day
    let cumClicks = 0;
    let cumLinks = 0;
    const series = days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const d = byDate[key] || { links: 0, clicks: 0 };
      cumClicks += d.clicks;
      cumLinks += d.links;
      return {
        date: format(day, "dd/MM", { locale: he }),
        fullDate: key,
        links: d.links,
        clicks: d.clicks,
        cumulativeClicks: cumClicks,
        cumulativeLinks: cumLinks,
      };
    });

    const r7 = series.slice(-7).reduce((s, d) => s + d.links, 0);
    const p7 = series.slice(-14, -7).reduce((s, d) => s + d.links, 0);

    return { timeSeriesData: series, recent7Clicks: r7, prev7Clicks: p7 };
  }, [links, filters.dateFrom]);

  const channelData = Object.values(channelStats).sort((a, b) => b.clicks - a.clicks);
  const campaignData = Object.values(campaignStats).sort((a, b) => b.clicks - a.clicks);
  const totalClicks = channelData.reduce((sum, item) => sum + item.clicks, 0);
  const totalLinks = links?.length || 0;
  const totalCampaigns = new Set(links?.map((l) => l.campaign_id).filter(Boolean)).size;
  const avgClicksPerLink = totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0;

  // Trend %
  const weekTrend = useMemo(() => {
    if (prev7Clicks === 0) return recent7Clicks > 0 ? 100 : 0;
    return Math.round(((recent7Clicks - prev7Clicks) / prev7Clicks) * 100);
  }, [recent7Clicks, prev7Clicks]);

  // CTR proxy: avg clicks per link relative to top performer
  const topLink = useMemo(
    () => (links ? [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0] : null),
    [links],
  );

  const topLinks = useMemo(() => {
    if (!links) return [];
    return [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 8);
  }, [links]);

  const maxLinkClicks = topLinks[0]?.clicks || 1;

  // Smart insights
  const insights = useMemo(() => {
    const arr: { icon: any; title: string; description: string; highlight?: string }[] = [];
    if (channelData[0]) {
      const pct = totalClicks > 0 ? Math.round((channelData[0].clicks / totalClicks) * 100) : 0;
      arr.push({
        icon: Trophy,
        title: "ערוץ מוביל",
        description: `${channelData[0].name} מייצר ${pct}% מהקליקים — `,
        highlight: `${channelData[0].clicks.toLocaleString()} קליקים`,
      });
    }
    if (campaignData[0] && campaignData[0].name !== "ללא קמפיין") {
      arr.push({
        icon: Target,
        title: "הקמפיין החזק ביותר",
        description: `${campaignData[0].name} עם ${campaignData[0].count} לינקים שצברו `,
        highlight: `${campaignData[0].clicks.toLocaleString()} קליקים`,
      });
    }
    if (topLink && (topLink.clicks ?? 0) > 0) {
      arr.push({
        icon: Flame,
        title: "לינק שובר שיאים",
        description: `הלינק המוביל ב-${topLink.channels?.name || "—"} צבר `,
        highlight: `${(topLink.clicks ?? 0).toLocaleString()} קליקים`,
      });
    }
    if (weekTrend !== 0) {
      arr.push({
        icon: weekTrend > 0 ? TrendingUp : Activity,
        title: weekTrend > 0 ? "מומנטום חיובי" : "ירידה במומנטום",
        description: `7 ימים אחרונים לעומת קודמים: `,
        highlight: `${weekTrend > 0 ? "+" : ""}${weekTrend}%`,
      });
    }
    const lowPerformers = links?.filter((l) => (l.clicks ?? 0) === 0).length || 0;
    if (lowPerformers > 0 && totalLinks > 0) {
      const pct = Math.round((lowPerformers / totalLinks) * 100);
      arr.push({
        icon: Zap,
        title: "פוטנציאל לא ממומש",
        description: `${pct}% מהלינקים (${lowPerformers}) עוד לא קיבלו קליקים — `,
        highlight: "כדאי לבדוק הפצה",
      });
    }
    if (totalCampaigns > 0) {
      arr.push({
        icon: Sparkles,
        title: "פיזור קמפיינים",
        description: `${totalCampaigns} קמפיינים פעילים בממוצע של `,
        highlight: `${Math.round(totalLinks / Math.max(totalCampaigns, 1))} לינקים לקמפיין`,
      });
    }
    return arr.slice(0, 6);
  }, [channelData, campaignData, topLink, weekTrend, links, totalLinks, totalClicks, totalCampaigns]);

  // Filtered table
  const filteredLinks = useMemo(() => {
    if (!links) return [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.short_link?.toLowerCase().includes(q) ||
        l.channels?.name?.toLowerCase().includes(q) ||
        l.campaigns?.name?.toLowerCase().includes(q) ||
        l.destination_url?.toLowerCase().includes(q),
    );
  }, [links, tableSearch]);

  // Export
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
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map((c) => escape(String(c ?? ""))).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ הורד בהצלחה");
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0 bg-gradient-to-b from-background via-background to-muted/30">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
        {/* ===== HERO HEADER ===== */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/5 p-6 lg:p-8 mb-8">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">
                  <Activity className="h-3 w-3" />
                  Live Analytics
                </span>
                {syncStatus?.last_success_at && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2.5 py-1 rounded-full border border-border">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    סנכרון: {format(new Date(syncStatus.last_success_at), "HH:mm", { locale: he })}
                  </span>
                )}
                {syncStatus?.status === "running" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2.5 py-1 rounded-full border border-border">
                    <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                    מסנכרן
                  </span>
                )}
                {syncStatus?.status === "failed" && !syncStatus?.last_success_at && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                    <AlertCircle className="h-3 w-3" />
                    סנכרון נכשל
                  </span>
                )}
              </div>
              <h1 className="text-3xl lg:text-5xl font-bold text-foreground tracking-tight mb-2">
                לוח בקרה אנליטי
              </h1>
              <p className="text-muted-foreground text-sm lg:text-base max-w-xl">
                תמונת מצב מלאה על ביצועי הקישורים, הקמפיינים והערוצים שלך — בזמן אמת.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleExport}
                disabled={isLoading || !links?.length}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground font-medium hover:bg-muted disabled:opacity-50 transition-all shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">ייצוא CSV</span>
              </button>
              <button
                onClick={handleSyncClicks}
                disabled={isSyncing || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                סנכרן נתונים
              </button>
            </div>
          </div>
        </div>

        {/* Sync Progress */}
        {isSyncing && syncProgress.total > 0 && (
          <div className="mb-6 bg-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                מסנכרן נתונים מ-Dub.co...
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {syncProgress.current}/{syncProgress.total} ({syncProgress.percent}%)
              </span>
            </div>
            <Progress value={syncProgress.percent} className="h-2" />
          </div>
        )}

        {/* Filters */}
        <AnalyticsFilters
          filters={filters}
          onFiltersChange={(next) => {
            setFilters(next);
            setPage(0);
          }}
        />

        {/* ===== KPI CARDS ===== */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8 mt-6">
          <InsightCard
            icon={MousePointerClick}
            title="סה״כ קליקים"
            value={totalClicks.toLocaleString()}
            subtitle={`${recent7Clicks.toLocaleString()} בשבוע האחרון`}
            trend={weekTrend !== 0 ? { value: weekTrend, label: "vs שבוע" } : null}
            variant="primary"
          />
          <InsightCard
            icon={Link2}
            title="לינקים פעילים"
            value={totalLinks.toLocaleString()}
            subtitle={`${links?.filter((l) => (l.clicks ?? 0) > 0).length || 0} עם קליקים`}
            variant="info"
          />
          <InsightCard
            icon={BarChart3}
            title="ערוצים"
            value={channelData.length.toString()}
            subtitle={channelData[0] ? `מוביל: ${channelData[0].name}` : "—"}
            variant="accent"
          />
          <InsightCard
            icon={FolderKanban}
            title="ממוצע קליקים ללינק"
            value={avgClicksPerLink.toLocaleString()}
            subtitle={`${totalCampaigns} קמפיינים פעילים`}
            variant="warning"
          />
        </div>

        {/* ===== SMART INSIGHTS ===== */}
        <SmartInsights insights={insights} />

        {/* ===== MAIN TIME SERIES ===== */}
        <div className="bg-card rounded-2xl border border-border p-5 lg:p-7 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                צמיחה ב-30 הימים האחרונים
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                קליקים מצטברים מכלל הלינקים שנוצרו עד אותו יום, ומספר הלינקים החדשים שנוצרו ביום
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">קליקים מצטברים</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-muted-foreground">לינקים חדשים ביום</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : timeSeriesData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-clicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-links" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={8} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      direction: "rtl",
                      boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.2)",
                    }}
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name === "clicks" ? "קליקים" : "לינקים חדשים",
                    ]}
                    labelFormatter={(label) => `תאריך: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#grad-clicks)"
                  />
                  <Area
                    type="monotone"
                    dataKey="links"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    fill="url(#grad-links)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-muted-foreground">
              <Calendar className="h-12 w-12 mb-3 opacity-50" />
              <p>אין נתונים עדיין</p>
            </div>
          )}
        </div>

        {/* ===== CHARTS GRID ===== */}
        <div className="grid gap-6 lg:grid-cols-5 mb-8">
          {/* Channel breakdown - donut */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5 lg:p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-1">פיזור לפי ערוץ</h2>
            <p className="text-xs text-muted-foreground mb-4">חלוקת קליקים בין הערוצים</p>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : channelData.length > 0 ? (
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData.slice(0, 8)}
                      dataKey="clicks"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {channelData.slice(0, 8).map((entry, i) => (
                        <Cell key={i} fill={entry.color || PIE_PALETTE[i % PIE_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        direction: "rtl",
                      }}
                      formatter={(value: number) => `${value.toLocaleString()} קליקים`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">סה״כ</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {totalClicks.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-3 opacity-50" />
                <p>אין נתונים עדיין</p>
              </div>
            )}

            {/* Mini legend */}
            {channelData.slice(0, 5).length > 0 && (
              <div className="mt-4 space-y-1.5 max-h-32 overflow-y-auto">
                {channelData.slice(0, 5).map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: c.color || PIE_PALETTE[i % PIE_PALETTE.length] }}
                      />
                      <span className="truncate text-foreground">{c.name}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-muted-foreground flex-shrink-0">
                      {c.clicks.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top performers leaderboard */}
          <div className="lg:col-span-3 bg-card rounded-2xl border border-border p-5 lg:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  הלינקים המובילים
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">8 הלינקים החזקים ביותר</p>
              </div>
            </div>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : topLinks.length > 0 ? (
              <div className="space-y-3">
                {topLinks.map((link, idx) => {
                  const pct = ((link.clicks ?? 0) / maxLinkClicks) * 100;
                  return (
                    <div key={link.id} className="group">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                              idx === 0
                                ? "bg-warning/20 text-warning"
                                : idx === 1
                                ? "bg-muted-foreground/20 text-muted-foreground"
                                : idx === 2
                                ? "bg-orange-500/20 text-orange-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: link.channels?.color || "#6366f1" }}
                          />
                          <span className="text-sm font-medium text-foreground truncate">
                            {link.channels?.name || "—"}
                          </span>
                          {link.campaigns?.name && (
                            <span className="hidden md:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[150px]">
                              {link.campaigns.name}
                            </span>
                          )}
                        </div>
                        <a
                          href={link.short_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                          dir="ltr"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-sm font-bold text-foreground tabular-nums flex-shrink-0 min-w-[60px] text-left">
                          {(link.clicks ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            background: `linear-gradient(90deg, ${
                              link.channels?.color || "hsl(var(--primary))"
                            }, ${link.channels?.color || "hsl(var(--primary))"}99)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <Link2 className="h-12 w-12 mb-3 opacity-50" />
                <p>אין לינקים עדיין</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== Campaigns leaderboard (horizontal bars) ===== */}
        {campaignData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-5 lg:p-6 shadow-sm mb-8">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-accent" />
              ביצועי קמפיינים
            </h2>
            <p className="text-xs text-muted-foreground mb-5">השוואת קליקים בין הקמפיינים</p>

            <div className="space-y-3">
              {campaignData.slice(0, 8).map((c, i) => {
                const max = campaignData[0].clicks || 1;
                const pct = (c.clicks / max) * 100;
                const color = PIE_PALETTE[i % PIE_PALETTE.length];
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground truncate flex-1 min-w-0">{c.name}</span>
                      <div className="flex items-center gap-3 flex-shrink-0 mr-3">
                        <span className="text-xs text-muted-foreground tabular-nums">{c.count} לינקים</span>
                        <span className="text-sm font-bold text-foreground tabular-nums min-w-[60px] text-left">
                          {c.clicks.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(pct, 1)}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Campaign-Channel Matrix ===== */}
        {links && links.length > 0 && (
          <div className="mb-8">
            <CampaignChannelMatrix links={links} />
          </div>
        )}

        {/* ===== ALL LINKS TABLE with search ===== */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">כל הלינקים</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredLinks.length} מתוך {totalLinks} לינקים
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לינק, ערוץ או קמפיין..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(0);
                }}
                className="pr-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredLinks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      קמפיין
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      ערוץ
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      לינק קצר
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      תאריך יצירה
                    </th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      קליקים
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLinks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-sm text-muted-foreground">{link.campaigns?.name || "—"}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: link.channels?.color || "#6366f1" }}
                          />
                          <span className="font-medium text-sm text-foreground">{link.channels?.name}</span>
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
                      <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground hidden md:table-cell tabular-nums">
                        {new Date(link.created_at).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-left">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                            (link.clicks ?? 0) > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {link.clicks?.toLocaleString() || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLinks.length > PAGE_SIZE && (
                <div className="flex items-center justify-between p-4 lg:px-6 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    עמוד {page + 1} מתוך {Math.ceil(filteredLinks.length / PAGE_SIZE)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      הקודם
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => ((p + 1) * PAGE_SIZE < filteredLinks.length ? p + 1 : p))
                      }
                      disabled={(page + 1) * PAGE_SIZE >= filteredLinks.length}
                      className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      הבא
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{tableSearch ? "לא נמצאו תוצאות" : "אין לינקים עדיין."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
