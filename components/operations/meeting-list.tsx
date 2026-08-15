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
  meetingStatusLabel,
  meetingStatusVariant,
} from "@/lib/operations/presentation";

interface MeetingRow {
  id: string;
  title: string;
  organizerName: string | null;
  scheduledAt: string;
  durationMinutes: number | null;
  virtualLink: string | null;
  status: string;
  agenda: string | null;
}

interface MeetingMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function MeetingList({
  initialRows,
  initialMeta,
}: {
  initialRows: MeetingRow[];
  initialMeta: MeetingMeta;
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

      const res = await fetch(`/api/meetings?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load meetings");
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
              placeholder="Search meetings…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Button size="sm" onClick={() => router.push("/meetings/new")}>
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {m.title}
                  </Link>
                </TableCell>
                <TableCell>{m.organizerName ?? "—"}</TableCell>
                <TableCell>{new Date(m.scheduledAt).toLocaleString()}</TableCell>
                <TableCell>
                  {m.durationMinutes ? `${m.durationMinutes}m` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={meetingStatusVariant(m.status)}>
                    {meetingStatusLabel(m.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {m.virtualLink ? (
                    <a
                      href={m.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      Join
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No meetings yet"
            description="Schedule a meeting to collaborate with your team."
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
