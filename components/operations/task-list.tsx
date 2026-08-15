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
  TASK_PRIORITY_LABELS,
  taskPriorityVariant,
  taskStatusLabel,
  taskStatusVariant,
} from "@/lib/operations/presentation";

interface TaskRow {
  id: string;
  title: string;
  assigneeName: string | null;
  clientName: string | null;
  opportunityName: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
}

interface TaskMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function TaskList({
  initialRows,
  initialMeta,
}: {
  initialRows: TaskRow[];
  initialMeta: TaskMeta;
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

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load tasks");
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
              placeholder="Search tasks…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="pending">To-Do</option>
            <option value="in_progress">In-Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </Select>
          <Button size="sm" onClick={() => router.push("/tasks/new")}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>{t.assigneeName ?? "—"}</TableCell>
                <TableCell>{t.clientName ?? "—"}</TableCell>
                <TableCell>{t.opportunityName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={taskPriorityVariant(t.priority)}>
                    {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={taskStatusVariant(t.status)}>
                    {taskStatusLabel(t.status)}
                  </Badge>
                </TableCell>
                <TableCell>{t.dueDate ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !loading && (
          <TableEmpty
            title="No tasks yet"
            description="Create your first task to track actionable work."
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
