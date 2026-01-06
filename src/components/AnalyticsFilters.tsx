import { Calendar, Filter, X } from "lucide-react";
import { useChannels } from "@/hooks/useChannels";
import { useCampaigns } from "@/hooks/useCampaigns";
import { LinksFilter } from "@/hooks/useGeneratedLinks";

interface AnalyticsFiltersProps {
  filters: LinksFilter;
  onFiltersChange: (filters: LinksFilter) => void;
}

export function AnalyticsFilters({ filters, onFiltersChange }: AnalyticsFiltersProps) {
  const { data: channels } = useChannels();
  const { data: campaigns } = useCampaigns();

  const hasFilters = filters.channelId || filters.campaignId || filters.dateFrom || filters.dateTo;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-foreground">סינון נתונים</h3>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            נקה סינון
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {/* Campaign Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            קמפיין
          </label>
          <select
            value={filters.campaignId || ""}
            onChange={(e) => onFiltersChange({ ...filters, campaignId: e.target.value || undefined })}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">כל הקמפיינים</option>
            {campaigns?.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            ערוץ
          </label>
          <select
            value={filters.channelId || ""}
            onChange={(e) => onFiltersChange({ ...filters, channelId: e.target.value || undefined })}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">כל הערוצים</option>
            {channels?.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            מתאריך
          </label>
          <div className="relative">
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            עד תאריך
          </label>
          <div className="relative">
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
