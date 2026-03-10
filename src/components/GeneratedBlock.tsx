import { Copy, Check, ExternalLink, QrCode, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
      toast.success(`הועתק בלוק ${channelName}!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("ההעתקה נכשלה");
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
          תצוגה מקדימה <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Content */}
      <div className="bg-muted/50 rounded-lg p-3 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {adCopy}
        </p>
        <p className="text-sm text-primary font-medium mt-2" dir="ltr">{shortLink}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
            copied
              ? "bg-success text-success-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              הועתק!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              העתק ללוח
            </>
          )}
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              <QrCode className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-foreground">QR Code - {channelName}</p>
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={shortLink} size={160} id={`qr-${index}`} />
              </div>
              <button
                onClick={() => {
                  const svg = document.getElementById(`qr-${index}`);
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  canvas.width = 320;
                  canvas.height = 320;
                  const ctx = canvas.getContext("2d");
                  const img = new Image();
                  img.onload = () => {
                    ctx?.drawImage(img, 0, 0, 320, 320);
                    const a = document.createElement("a");
                    a.download = `qr-${channelName}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3 w-3" />
                הורד PNG
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
