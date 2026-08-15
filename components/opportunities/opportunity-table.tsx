"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableEmpty,
} from "@/components/ui";
import { PIPELINE_STAGES, stageLabel, stageVariant } from "@/lib/opportunities/pipeline";
import { formatMoney } from "@/lib/money";

interface OpportunityRow {
  id: string;
  opportunityNumber: string;
  name: string;
  clientName: string;
  ownerName: string | null;
  stageKey: string;
  stageName: string;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  createdAt: string;
}

interface OpportunityMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function OpportunityTable({
  initialRows,
  initialMeta,
}: {
  initialRows: OpportunityRow[];
  initialMeta: OpportunityMeta;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [stageKey, setStageKey] = useState(searchParams.get("stageKey") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);
      if (stageKey) params.set("stageKey", stageKey);

      const res = await fetch(`/api/opportunities?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load opportunities");
      setRows(json.data);
      setMeta({
        page: json.meta?.page ?? 1,
        pageSize: json.meta?.pageSize ?? 20,
        total: json.meta?.total ?? 0,
        totalPages: json.meta?.totalPages ?? 1,
      });
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [page, meta.pageSize, search, stageKey]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, client, product…"
              className="pl-9"
            />
          </div>
          <Select
            value={stageKey}
            onChange={(e) => setStageKey(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                (window.location.href = `/api/opportunities/export?format=csv&search=${encodeURIComponent(search)}&stageKey=${stageKey}`)
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push("/opportunities/new")}>
              <Plus className="h-4 w-4" />
              New Opportunity
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Probability</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Expected Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={`/opportunities/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    {o.opportunityNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/opportunities/${o.id}`} className="text-foreground hover:underline">
                    {o.name}
                  </Link>
                </TableCell>
                <TableCell>{o.clientName}</TableCell>
                <TableCell>{o.ownerName ?? "—"}</TableCell>
                <TableCell>{formatMoney(o.amount)}</TableCell>
                <TableCell>{o.probability != null ? `${o.probability}%` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={stageVariant(o.stageKey)} dot>
                    {stageLabel(o.stageKey)}
                  </Badge>
                </TableCell>
                <TableCell>{o.expectedCloseDate ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No opportunities yet"
            description="Create your first opportunity to start tracking deals."
          />
        )}

        <TablePagination
          page={meta.page}
          pageCount={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
