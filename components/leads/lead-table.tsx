"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
} from "@/lib/leads/schemas";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  sourceLabel,
  statusLabel,
  statusVariant,
} from "@/lib/leads/presentation";
import type { LeadListItem, LeadListMeta } from "@/lib/leads/types";

type SortColumn =
  | "createdAt"
  | "fullName"
  | "companyName"
  | "status"
  | "source"
  | "aiScore";

interface LeadTableProps {
  initialRows: LeadListItem[];
  initialMeta: LeadListMeta;
}

const SORTABLE: { key: SortColumn; label: string }[] = [
  { key: "createdAt", label: "Created" },
  { key: "fullName", label: "Name" },
  { key: "companyName", label: "Company" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "aiScore", label: "AI Score" },
];

function AiBadge({ aiScore }: { aiScore: number | null }) {
  if (aiScore == null) {
    return <Badge variant="neutral">Not scored yet</Badge>;
  }
  return <Badge variant="ai">{aiScore}</Badge>;
}

export function LeadTable({ initialRows, initialMeta }: LeadTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [source, setSource] = useState(searchParams.get("source") ?? "");
  const [sortBy, setSortBy] = useState<SortColumn>(
    (searchParams.get("sortBy") as SortColumn) || "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
  );
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load leads");
      setRows(json.data);
      setMeta({
        page: json.meta?.page ?? 1,
        pageSize: json.meta?.pageSize ?? 20,
        total: json.meta?.total ?? 0,
        totalPages: json.meta?.totalPages ?? 1,
      });
    } catch {
      /* keep previous data on failure */
    } finally {
      setLoading(false);
    }
  }, [page, meta.pageSize, search, status, source, sortBy, sortOrder]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  function toggleSort(col: SortColumn) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder(col === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  function resetPage() {
    setPage(1);
  }

  function exportHref(format: string): string {
    const params = new URLSearchParams();
    params.set("format", format);
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    return `/api/leads/export?${params.toString()}`;
  }

  function SortIcon({ col }: { col: SortColumn }): ReactNode {
    if (sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") resetPage();
              }}
              placeholder="Search name, email, company…"
              className="pl-9"
              aria-label="Search leads"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              resetPage();
            }}
            className="sm:w-40"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              resetPage();
            }}
            className="sm:w-44"
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/leads/new")}
          >
            <Plus className="h-4 w-4" />
            New lead
          </Button>
          <div className="flex items-center gap-1">
            <a href={exportHref("csv")} className="inline-flex">
              <Button size="sm" variant="ghost" title="Export CSV">
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </a>
            <a href={exportHref("xlsx")} className="inline-flex">
              <Button size="sm" variant="ghost" title="Export XLSX">
                XLSX
              </Button>
            </a>
            <a href={exportHref("pdf")} className="inline-flex">
              <Button size="sm" variant="ghost" title="Export PDF">
                PDF
              </Button>
            </a>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <TableEmpty
              title="No leads found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {SORTABLE.map((c) => (
                      <TableHead key={c.key}>
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 uppercase tracking-wider"
                        >
                          {c.label}
                          <SortIcon col={c.key} />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead>Email</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>AI Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="text-xs text-faint">
                        {lead.leadNumber}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {lead.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{lead.companyName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)} dot>
                          {statusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {sourceLabel(lead.source)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {lead.ownerName ?? "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <AiBadge aiScore={lead.aiScore} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={meta.page}
                pageCount={Math.max(1, meta.totalPages)}
                total={meta.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
