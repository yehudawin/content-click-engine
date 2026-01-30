import { Link2, ExternalLink, MousePointerClick } from "lucide-react";
import { GeneratedLink } from "@/hooks/useGeneratedLinks";

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
          
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MousePointerClick className="h-4 w-4 text-primary" />
            <span>{(link.clicks || 0).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
