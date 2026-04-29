import { Link2, ExternalLink, MousePointerClick, QrCode, Download } from "lucide-react";
import { GeneratedLink } from "@/hooks/useGeneratedLinks";
import { QRCodeSVG } from "qrcode.react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface CampaignLinksProps {
  links: GeneratedLink[];
}

export function CampaignLinks({ links }: CampaignLinksProps) {
  if (links.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <Link2 className="h-5 w-5 mx-auto mb-2 opacity-50" />
        <p>אין לינקים בקמפיין זה</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {link.channels?.color && (
              <div
                className="w-2 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: link.channels.color }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={link.short_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline truncate flex items-center gap-1"
                >
                  {link.short_link}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {link.channels?.name && (
                  <span className="text-xs text-muted-foreground">
                    {link.channels.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  · {new Date(link.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <QrCode className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-medium text-foreground">QR Code</p>
                  <div className="bg-white p-3 rounded-lg">
                    <QRCodeSVG value={link.short_link} size={160} id={`qr-link-${link.id}`} />
                  </div>
                  <button
                    onClick={() => {
                      const svg = document.getElementById(`qr-link-${link.id}`);
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
                        a.download = `qr-${link.channels?.name || "link"}.png`;
                        a.href = canvas.toDataURL("image/png");
                        a.click();
                      };
                      img.src = "data:image/svg+xml;base64," + utf8ToBase64(svgData);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    הורד PNG
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MousePointerClick className="h-4 w-4 text-primary" />
              <span>{(link.clicks || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
