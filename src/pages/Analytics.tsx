import { BarChart3, ExternalLink, TrendingUp, Link2 } from "lucide-react";
import { useGeneratedLinks } from "@/hooks/useGeneratedLinks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function Analytics() {
  const { data: links, isLoading } = useGeneratedLinks();

  // Aggregate clicks by channel
  const channelStats = links?.reduce((acc, link) => {
    const channelName = link.channels?.name || "Unknown";
    const color = link.channels?.color || "#6366f1";
    
    if (!acc[channelName]) {
      acc[channelName] = { name: channelName, clicks: 0, count: 0, color };
    }
    acc[channelName].clicks += link.clicks || 0;
    acc[channelName].count += 1;
    return acc;
  }, {} as Record<string, { name: string; clicks: number; count: number; color: string }>);

  const chartData = Object.values(channelStats || {});
  const totalClicks = chartData.reduce((sum, item) => sum + item.clicks, 0);
  const totalLinks = links?.length || 0;

  return (
    <div className="min-h-screen lg:pl-0 pt-16 lg:pt-0">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track performance across all your distribution channels
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Clicks</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalClicks.toLocaleString()}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Total Links</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalLinks}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-info" />
              </div>
              <span className="text-sm text-muted-foreground">Active Channels</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{chartData.length}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Clicks by Channel
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
              <p>No data yet. Generate some links to see analytics!</p>
            </div>
          )}
        </div>

        {/* Links Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Recent Links</h2>
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
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Short Link
                    </th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Created
                    </th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Clicks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {links.slice(0, 10).map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
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
                        >
                          {link.short_link}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {link.clicks}
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
              <p>No links generated yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
