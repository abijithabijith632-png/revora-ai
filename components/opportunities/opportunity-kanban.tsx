"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  PIPELINE_STAGES,
  stageLabel,
  stageVariant,
  canTransition,
  type PipelineStageKey,
} from "@/lib/opportunities/pipeline";
import { formatMoney } from "@/lib/money";

interface KanbanCard {
  id: string;
  opportunityNumber: string;
  name: string;
  clientName: string;
  ownerName: string | null;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  stageKey: string;
}

export function OpportunityKanban({ cards }: { cards: KanbanCard[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<KanbanCard[]>(cards);
  const [dragging, setDragging] = useState<string | null>(null);

  async function drop(targetKey: string, card: KanbanCard) {
    if (card.stageKey === targetKey) return;
    if (!canTransition(card.stageKey as PipelineStageKey, targetKey as PipelineStageKey)) {
      toast({
        variant: "error",
        title: "Invalid transition",
        description: `Cannot move from ${stageLabel(card.stageKey)} to ${stageLabel(targetKey)}.`,
      });
      return;
    }

    // Optimistic update.
    const previous = items;
    setItems((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, stageKey: targetKey } : c)),
    );

    try {
      const res = await fetch(`/api/opportunities/${card.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageKey: targetKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Opportunity moved." });
      router.refresh();
    } catch (err) {
      // Rollback visual position.
      setItems(previous);
      toast({
        variant: "error",
        title: "Unable to move opportunity",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => {
        const stageCards = items.filter((c) => c.stageKey === stage.key);
        return (
          <div
            key={stage.key}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface-subtle/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const cardId = dragging;
              const card = items.find((c) => c.id === cardId);
              if (card) drop(stage.key, card);
              setDragging(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{stage.label}</span>
              <Badge variant={stageVariant(stage.key)}>{stageCards.length}</Badge>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {stageCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/opportunities/${card.id}`}
                  draggable
                  onDragStart={() => setDragging(card.id)}
                  onDragEnd={() => setDragging(null)}
                  className="block cursor-grab rounded-md border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow"
                >
                  <p className="text-sm font-medium text-foreground">{card.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {card.opportunityNumber} · {card.clientName}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {formatMoney(card.amount)}
                    </span>
                    <span className="text-muted-foreground">
                      {card.probability != null ? `${card.probability}%` : "—"}
                    </span>
                  </div>
                  {card.expectedCloseDate && (
                    <p className="mt-1 text-xs text-faint">{card.expectedCloseDate}</p>
                  )}
                </Link>
              ))}
              {stageCards.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-faint">Drop here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
