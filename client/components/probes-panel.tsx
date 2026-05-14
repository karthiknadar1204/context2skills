"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Flame, Leaf, PackageOpen } from "lucide-react";
import type { Probe } from "@/lib/types";

function ProbeCard({ probe, kind }: { probe: Probe; kind: "hard" | "easy" }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-mono">
            iter {probe.iterNum} · task #{probe.taskId}
          </CardTitle>
          <Badge variant={kind === "hard" ? "destructive" : "default"}>
            {kind === "hard" ? (
              <Flame className="mr-1 h-3 w-3" />
            ) : (
              <Leaf className="mr-1 h-3 w-3" />
            )}
            {kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed">{probe.task}</p>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {probe.rubrics.length} rubrics
          </p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {probe.rubrics.slice(0, 3).map((r, i) => (
              <li key={i} className="line-clamp-1">
                • {r}
              </li>
            ))}
            {probe.rubrics.length > 3 && (
              <li className="text-[11px]">
                + {probe.rubrics.length - 3} more
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProbesPanel({ contextId }: { contextId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["probes", contextId],
    queryFn: () => api.listProbes(contextId),
    refetchInterval: 5000,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data || (data.hard.length === 0 && data.easy.length === 0)) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No probes yet — they're collected during training.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>How probes work</CardTitle>
          <CardDescription className="text-xs">
            During each iteration, the worker stashes the hardest failure and
            the easiest pass. Cross-Time Replay later grades every candidate
            skill set against these probes to pick the most generalizable one.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold">Hard probes ({data.hard.length})</h3>
            <p className="text-xs text-muted-foreground">
              hardest failure per iter
            </p>
          </div>
          <div className="space-y-3">
            {data.hard.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No failures observed — Challenger may be too soft.
              </p>
            ) : (
              data.hard.map((p) => (
                <ProbeCard
                  key={`${p.iterNum}-${p.taskId}`}
                  probe={p}
                  kind="hard"
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold">Easy probes ({data.easy.length})</h3>
            <p className="text-xs text-muted-foreground">
              simplest pass per iter
            </p>
          </div>
          <div className="space-y-3">
            {data.easy.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No passes observed.
              </p>
            ) : (
              data.easy.map((p) => (
                <ProbeCard
                  key={`${p.iterNum}-${p.taskId}`}
                  probe={p}
                  kind="easy"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
