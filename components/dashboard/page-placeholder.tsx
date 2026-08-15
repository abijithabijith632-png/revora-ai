import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/components/ui";

/**
 * Architectural placeholder for future business modules.
 *
 * Clearly marks a module as "planned" (not implemented) so unfinished
 * functionality is never presented as complete.
 */
export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="info">Planned</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle className="pt-3">Module foundation ready</CardTitle>
          <CardDescription>
            This route and its architectural boundaries are in place. Business
            functionality is scheduled for a later phase of the 25-phase plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No placeholder data is shown here — only the navigation, layout,
            and server/API foundations are active.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
