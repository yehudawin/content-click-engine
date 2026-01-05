import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  color: string;
}

interface ChannelSelectorProps {
  channels: Channel[];
  selectedChannels: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
}

export function ChannelSelector({
  channels,
  selectedChannels,
  onSelectionChange,
  isLoading,
}: ChannelSelectorProps) {
  const toggleChannel = (id: string) => {
    if (selectedChannels.includes(id)) {
      onSelectionChange(selectedChannels.filter((c) => c !== id));
    } else {
      onSelectionChange([...selectedChannels, id]);
    }
  };

  const selectAll = () => {
    if (selectedChannels.length === channels.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(channels.map((c) => c.id));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Target Channels
        </label>
        <button
          type="button"
          onClick={selectAll}
          className="text-xs text-primary hover:underline"
        >
          {selectedChannels.length === channels.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {channels.map((channel) => {
          const isSelected = selectedChannels.includes(channel.id);
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => toggleChannel(channel.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              )}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: channel.color }}
              />
              <span className="text-sm font-medium">{channel.name}</span>
              {isSelected && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>

      {selectedChannels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedChannels.length} channel{selectedChannels.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
