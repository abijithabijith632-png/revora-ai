import { BaseService } from "./base";
import { TaskRepository } from "@/server/repositories/tasks";
import { ActivityService } from "./activities";
import { NotificationService } from "./notifications";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { clients, leads, opportunities, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateTaskInput,
  TaskFilter,
  TaskReassignInput,
  TaskStatusInput,
  UpdateTaskInput,
} from "@/lib/operations/schemas";

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

export class TaskService extends BaseService {
  private readonly repo: TaskRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new TaskRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: TaskFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });
  }

  async getById(id: string) {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError("Task not found.");
    return task;
  }

  private async validateAssignee(assignedTo?: string | null) {
    if (!assignedTo) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${assignedTo} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) throw new ValidationError("Assignee must belong to this organization.");
    if (user.status !== "active") throw new ValidationError("Assignee must be an active user.");
  }

  private async validateRelations(input: {
    leadId?: string | null;
    clientId?: string | null;
    opportunityId?: string | null;
  }) {
    const checks: Promise<unknown>[] = [];
    if (input.leadId) checks.push(db.select({ id: leads.id }).from(leads).where(sql`${leads.id} = ${input.leadId} AND ${leads.organizationId} = ${this.repo.orgId}`).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Lead not found in this organization."); }));
    if (input.clientId) checks.push(db.select({ id: clients.id }).from(clients).where(sql`${clients.id} = ${input.clientId} AND ${clients.organizationId} = ${this.repo.orgId}`).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Client not found in this organization."); }));
    if (input.opportunityId) checks.push(db.select({ id: opportunities.id }).from(opportunities).where(sql`${opportunities.id} = ${input.opportunityId} AND ${opportunities.organizationId} = ${this.repo.orgId}`).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Opportunity not found in this organization."); }));
    await Promise.all(checks);
  }

  async create(actor: { userId: string }, input: CreateTaskInput) {
    await this.validateAssignee(input.assignedTo ?? actor.userId);
    await this.validateRelations(input);

    const task = await this.repo.create({
      title: input.title,
      description: input.description ?? null,
      assignedTo: input.assignedTo ?? actor.userId,
      createdBy: actor.userId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority,
      status: input.status,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
    });

    await new ActivityService(this.repo.orgId).recordActivity({
      type: "task",
      subject: input.title,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
      performedBy: actor.userId,
    });

    // Due/overdue notification to the assignee so task deadlines surface
    // in-app without a background scheduler.
    try {
      const assignee = task.assignedTo ?? actor.userId;
      const due = task.dueDate ? new Date(task.dueDate) : null;
      const overdue = due ? due.getTime() < Date.now() : false;
      await new NotificationService(this.repo.orgId).notify({
        userId: assignee,
        type: "task_due",
        title: overdue ? "Task overdue" : "Task assigned",
        message: due
          ? `Task "${task.title}" is ${overdue ? "overdue since" : "due on"} ${due.toLocaleDateString()}.`
          : `Task "${task.title}" was assigned to you.`,
        entityType: "task",
        entityId: task.id,
      });
    } catch {
      // Notifications must never break task creation.
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "task",
      entityId: task.id,
    });

    return task;
  }

  async update(actor: { userId: string }, id: string, input: UpdateTaskInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");

    if (input.assignedTo !== undefined) {
      await this.validateAssignee(input.assignedTo);
    }
    await this.validateRelations({
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      opportunityId: input.opportunityId !== undefined ? input.opportunityId : existing.opportunityId,
    });

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      description:
        input.description !== undefined ? input.description : existing.description,
      assignedTo:
        input.assignedTo !== undefined ? input.assignedTo : existing.assignedTo,
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      opportunityId:
        input.opportunityId !== undefined
          ? input.opportunityId
          : existing.opportunityId,
    };

    const updated = await this.repo.update(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "task",
      entityId: id,
    });

    return updated;
  }

  async complete(actor: { userId: string }, id: string, input: TaskStatusInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");

    const completedAt =
      input.status === "completed" ? new Date() : existing.completedAt;

    const updated = await this.repo.update(id, {
      status: input.status,
      completedAt,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "task",
      entityId: id,
      metadata: { from: existing.status, to: input.status },
    });

    return updated;
  }

  async reassign(actor: { userId: string }, id: string, input: TaskReassignInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");

    await this.validateAssignee(input.assignedTo);

    const updated = await this.repo.update(id, { assignedTo: input.assignedTo });

    if (input.assignedTo) {
      await new NotificationService(this.repo.orgId).notify({
        userId: input.assignedTo,
        type: "assignment",
        title: "Task assigned to you",
        message: `Task "${existing.title}" has been assigned to you.`,
        entityType: "task",
        entityId: id,
      });
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "assign",
      entityType: "task",
      entityId: id,
      metadata: { from: existing.assignedTo, to: input.assignedTo },
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Task not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "task",
      entityId: id,
    });

    return { id };
  }
}
