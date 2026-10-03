import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export function NextActionCard({ suggestion }: { suggestion: { action: string; reason: string; method: string } | null }) {
  return <Card><CardHeader><CardTitle>Recommended next action</CardTitle><CardDescription>
    {suggestion ? `Method: ${suggestion.method.replaceAll("_", " ")}` : "No recommendation available"}
  </CardDescription></CardHeader><CardContent>
    {suggestion ? <><p className="text-sm font-medium">{suggestion.action}</p><p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p></> :
      <p className="text-sm text-muted-foreground">The CRM record could not be loaded for a recommendation.</p>}
  </CardContent></Card>;
}

export function DataQualityCard({ issues, duplicateCount }: { issues: Array<{ field: string; issue: string; suggestion: string }>; duplicateCount: number }) {
  return <Card><CardHeader><CardTitle>CRM data quality</CardTitle><CardDescription>Suggestions only; records are never changed automatically.</CardDescription></CardHeader>
    <CardContent className="space-y-2">
      {duplicateCount > 0 && <p className="text-sm">Possible duplicate records: {duplicateCount}. Review the duplicate panel before merging.</p>}
      {issues.length ? issues.slice(0, 5).map((issue) => <div key={issue.field} className="text-sm"><p className="font-medium">{issue.issue}</p><p className="text-muted-foreground">{issue.suggestion}</p></div>) :
        duplicateCount === 0 ? <p className="text-sm text-muted-foreground">No obvious completeness or format issues detected.</p> : null}
    </CardContent></Card>;
}
