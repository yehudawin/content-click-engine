import { LucideIcon } from "lucide-react";

interface SmartInsight {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight?: string;
}

export function SmartInsights({ insights }: { insights: SmartInsight[] }) {
  if (!insights.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mb-8">
      {insights.map((insight, i) => {
        const Icon = insight.icon;
        return (
          <div
            key={i}
            className="group relative overflow-hidden rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 hover:border-primary/40 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground mb-0.5">{insight.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {insight.description}
                  {insight.highlight && (
                    <span className="font-bold text-foreground mr-1">{insight.highlight}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
