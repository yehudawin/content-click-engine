import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label?: string } | null;
  variant?: "primary" | "accent" | "info" | "warning" | "destructive";
  className?: string;
}

const variantStyles: Record<NonNullable<InsightCardProps["variant"]>, string> = {
  primary:
    "from-primary/15 via-primary/5 to-transparent border-primary/20 [--ring-color:hsl(var(--primary))]",
  accent:
    "from-accent/15 via-accent/5 to-transparent border-accent/20 [--ring-color:hsl(var(--accent))]",
  info:
    "from-info/15 via-info/5 to-transparent border-info/20 [--ring-color:hsl(var(--info))]",
  warning:
    "from-warning/15 via-warning/5 to-transparent border-warning/20 [--ring-color:hsl(var(--warning))]",
  destructive:
    "from-destructive/15 via-destructive/5 to-transparent border-destructive/20 [--ring-color:hsl(var(--destructive))]",
};

const iconColors: Record<NonNullable<InsightCardProps["variant"]>, string> = {
  primary: "bg-primary/15 text-primary",
  accent: "bg-accent/15 text-accent",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function InsightCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  variant = "primary",
  className,
}: InsightCardProps) {
  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all hover:shadow-lg hover:-translate-y-0.5",
        variantStyles[variant],
        className,
      )}
    >
      {/* Decorative ring */}
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-[var(--ring-color)] opacity-10 blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", iconColors[variant])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
              trendPositive && "bg-success/15 text-success",
              trendNegative && "bg-destructive/15 text-destructive",
              !trendPositive && !trendNegative && "bg-muted text-muted-foreground",
            )}
          >
            {trendPositive ? "↑" : trendNegative ? "↓" : "—"} {Math.abs(trend.value)}%
            {trend.label && <span className="opacity-70 mr-1">{trend.label}</span>}
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5">{title}</p>
        <p className="text-3xl lg:text-4xl font-bold text-foreground tabular-nums leading-none">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-2 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
