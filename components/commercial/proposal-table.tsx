"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
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
  proposalStatusLabel,
  proposalStatusVariant,
} from "@/lib/commercial/presentation";
import { formatMoney } from "@/lib/money";

interface ProposalRow {
  id: string;
  opportunityName: string;
  clientName: string | null;
  ownerName: string | null;
  title: string;
  amount: number | null;
  status: string;
  createdAt: string;
}

interface ProposalMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ProposalTable({
  initialRows,
  initialMeta,
}: {
  initialRows: ProposalRow[];
  initialMeta: ProposalMeta;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(meta.pageSize || 20));
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/proposals?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load proposals");
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
  }, [page, meta.pageSize, search, status]);

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
              placeholder="Search proposals…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All statuses</option>
            {["draft", "sent", "viewed", "accepted", "rejected", "expired", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {proposalStatusLabel(s)}
                </option>
              ),
            )}
          </Select>
          <Button size="sm" onClick={() => router.push("/proposals/new")}>
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/proposals/${p.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell>{p.opportunityName}</TableCell>
                <TableCell>{p.clientName ?? "—"}</TableCell>
                <TableCell>{p.ownerName ?? "—"}</TableCell>
                <TableCell>{formatMoney(p.amount)}</TableCell>
                <TableCell>
                  <Badge variant={proposalStatusVariant(p.status)}>
                    {proposalStatusLabel(p.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No proposals yet"
            description="Create your first proposal from an opportunity."
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
