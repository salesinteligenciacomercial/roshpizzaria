import { OUTCOME_OPTIONS } from "@/hooks/useInteractions";
import { cn } from "@/lib/utils";

interface Props {
  outcome: string;
  className?: string;
}

export function LeadOutcomeBadge({ outcome, className }: Props) {
  const opt = OUTCOME_OPTIONS.find(o => o.value === outcome);
  if (!opt) return <span className="text-xs text-muted-foreground">{outcome}</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white",
        opt.color,
        outcome === "no_response" && "text-muted-foreground",
        className
      )}
    >
      {opt.label}
    </span>
  );
}
