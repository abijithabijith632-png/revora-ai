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
  followupChannelLabel,
  followupStatusLabel,
  followupStatusVariant,
} from "@/lib/operations/presentation";

interface FollowupRow {
  id: string;
  clientName: string | null;
  opportunityName: string | null;
  assigneeName: string | null;
  channel: string;
  scheduledAt: string;
  priority: string;
  status: string;
  actionDescription: string | null;
}

interface FollowupMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function FollowupList({
  initialRows,
  initialMeta,
}: {
  initialRows: FollowupRow[];
  initialMeta: FollowupMeta;
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

      const res = await fetch(`/api/followups?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load follow-ups");
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
              placeholder="Search follow-ups…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="skipped">Skipped</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Button size="sm" onClick={() => router.push("/activities")}>
            <Plus className="h-4 w-4" />
            Schedule
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/followups/${f.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {f.actionDescription ?? "Follow-up"}
                  </Link>
                </TableCell>
                <TableCell>{f.clientName ?? "—"}</TableCell>
                <TableCell>{f.opportunityName ?? "—"}</TableCell>
                <TableCell>{f.assigneeName ?? "—"}</TableCell>
                <TableCell>{followupChannelLabel(f.channel)}</TableCell>
                <TableCell>
                  <Badge variant={followupStatusVariant(f.status)}>
                    {followupStatusLabel(f.status)}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(f.scheduledAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No follow-ups yet"
            description="Schedule a follow-up to stay on top of touchpoints."
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
