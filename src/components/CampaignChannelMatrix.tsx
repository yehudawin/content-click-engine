import { useMemo } from "react";
import { GeneratedLink } from "@/hooks/useGeneratedLinks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, TrendingUp } from "lucide-react";

interface CampaignChannelMatrixProps {
  links: GeneratedLink[];
}

interface MatrixCell {
  clicks: number;
  linkCount: number;
}

interface MatrixData {
  [campaignName: string]: {
    [channelName: string]: MatrixCell;
  };
}

export function CampaignChannelMatrix({ links }: CampaignChannelMatrixProps) {
  // Build the matrix data
  const { matrixData, campaigns, channels, totals } = useMemo(() => {
    const matrix: MatrixData = {};
    const channelSet = new Set<string>();
    const campaignSet = new Set<string>();
    
    // Calculate totals
    const channelTotals: Record<string, MatrixCell> = {};
    const campaignTotals: Record<string, MatrixCell> = {};
    let grandTotal: MatrixCell = { clicks: 0, linkCount: 0 };

    links.forEach((link) => {
      const campaignName = link.campaigns?.name || "ללא קמפיין";
      const channelName = link.channels?.name || "לא ידוע";
      const clicks = link.clicks || 0;

      campaignSet.add(campaignName);
      channelSet.add(channelName);

      // Initialize if needed
      if (!matrix[campaignName]) {
        matrix[campaignName] = {};
      }
      if (!matrix[campaignName][channelName]) {
        matrix[campaignName][channelName] = { clicks: 0, linkCount: 0 };
      }

      // Add data
      matrix[campaignName][channelName].clicks += clicks;
      matrix[campaignName][channelName].linkCount += 1;

      // Update totals
      if (!channelTotals[channelName]) {
        channelTotals[channelName] = { clicks: 0, linkCount: 0 };
      }
      channelTotals[channelName].clicks += clicks;
      channelTotals[channelName].linkCount += 1;

      if (!campaignTotals[campaignName]) {
        campaignTotals[campaignName] = { clicks: 0, linkCount: 0 };
      }
      campaignTotals[campaignName].clicks += clicks;
      campaignTotals[campaignName].linkCount += 1;

      grandTotal.clicks += clicks;
      grandTotal.linkCount += 1;
    });

    // Sort campaigns and channels by total clicks
    const sortedCampaigns = Array.from(campaignSet).sort(
      (a, b) => (campaignTotals[b]?.clicks || 0) - (campaignTotals[a]?.clicks || 0)
    );
    const sortedChannels = Array.from(channelSet).sort(
      (a, b) => (channelTotals[b]?.clicks || 0) - (channelTotals[a]?.clicks || 0)
    );

    return {
      matrixData: matrix,
      campaigns: sortedCampaigns,
      channels: sortedChannels,
      totals: { channelTotals, campaignTotals, grandTotal },
    };
  }, [links]);

  if (links.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <FolderKanban className="h-12 w-12 mb-3 opacity-50" />
          <p>אין נתונים להצגה</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          מטריצת קמפיינים × ערוצים
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          קליקים ומספר לינקים לכל שילוב של קמפיין וערוץ
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold text-right min-w-[150px] sticky right-0 bg-muted/50 z-10">
                קמפיין / ערוץ
              </TableHead>
              {channels.map((channel) => (
                <TableHead key={channel} className="text-center min-w-[120px]">
                  <div className="font-medium truncate" title={channel}>
                    {channel}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">
                    סה״כ: {totals.channelTotals[channel]?.clicks || 0}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[100px] bg-primary/10 font-bold">
                סה״כ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign} className="hover:bg-muted/30">
                <TableCell className="font-medium text-right sticky right-0 bg-card z-10">
                  <div className="truncate max-w-[150px]" title={campaign}>
                    {campaign}
                  </div>
                </TableCell>
                {channels.map((channel) => {
                  const cell = matrixData[campaign]?.[channel];
                  return (
                    <TableCell key={`${campaign}-${channel}`} className="text-center">
                      {cell ? (
                        <div>
                          <span className={`font-semibold ${cell.clicks > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {cell.clicks}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            ({cell.linkCount} לינקים)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center bg-primary/5 font-bold">
                  <span className="text-primary">
                    {totals.campaignTotals[campaign]?.clicks || 0}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    ({totals.campaignTotals[campaign]?.linkCount || 0} לינקים)
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {/* Grand total row */}
            <TableRow className="bg-primary/10 font-bold">
              <TableCell className="text-right sticky right-0 bg-primary/10 z-10">
                סה״כ כללי
              </TableCell>
              {channels.map((channel) => (
                <TableCell key={`total-${channel}`} className="text-center">
                  <span className="text-primary font-bold">
                    {totals.channelTotals[channel]?.clicks || 0}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    ({totals.channelTotals[channel]?.linkCount || 0})
                  </span>
                </TableCell>
              ))}
              <TableCell className="text-center bg-primary/20">
                <span className="text-primary text-lg font-bold">
                  {totals.grandTotal.clicks}
                </span>
                <span className="text-xs text-muted-foreground block">
                  ({totals.grandTotal.linkCount} לינקים)
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
