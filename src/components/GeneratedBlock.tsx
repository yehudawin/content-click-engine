import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface GeneratedBlockProps {
  channelName: string;
  channelColor: string;
  adCopy: string;
  shortLink: string;
  index: number;
}

export function GeneratedBlock({
  channelName,
  channelColor,
  adCopy,
  shortLink,
  index,
}: GeneratedBlockProps) {
  const [copied, setCopied] = useState(false);

  const fullText = `${adCopy}\n\n${shortLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success(`Copied ${channelName} block!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <div
      className="bg-card rounded-xl border border-border p-4 shadow-sm animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: channelColor }}
          />
          <span className="font-medium text-sm">{channelName}</span>
        </div>
        <a
          href={shortLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          Preview <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Content */}
      <div className="bg-muted/50 rounded-lg p-3 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {adCopy}
        </p>
        <p className="text-sm text-primary font-medium mt-2">{shortLink}</p>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
          copied
            ? "bg-success text-success-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </>
        )}
      </button>
    </div>
  );
}
