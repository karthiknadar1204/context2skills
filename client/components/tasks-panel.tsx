"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, PackageOpen, X } from "lucide-react";
import type { TaskRecord } from "@/lib/types";

export function TasksPanel({ contextId }: { contextId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", contextId],
    queryFn: () => api.listTasks(contextId),
    refetchInterval: 5000,
  });
  const [selected, setSelected] = useState<TaskRecord | null>(null);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tasks yet — they're produced during training.
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = selected ?? data[0];

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            All tasks ({data.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[600px]">
            <div className="space-y-1">
              {data.map((t) => {
                const active = current?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {t.solved ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>iter {t.iterNum}</span>
                        <span>·</span>
                        <span>#{t.id}</span>
                        <span>·</span>
                        <span>{t.rubrics.length}r</span>
                      </div>
                      <p className="line-clamp-2 text-foreground">{t.task}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Task #{current?.id} · iter {current?.iterNum}
              </CardTitle>
              <CardDescription className="mt-1">
                {current?.solved ? "PASSED" : "FAILED"} ·{" "}
                {current?.rubrics.length} rubrics
              </CardDescription>
            </div>
            <Badge variant={current?.solved ? "default" : "destructive"}>
              {current?.solved ? "PASS" : "FAIL"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section title="Task">
            <p className="text-sm whitespace-pre-wrap">{current?.task}</p>
          </Section>

          <Section title="Rubrics">
            <ul className="space-y-1.5">
              {current?.rubrics.map((r, i) => {
                const verdict =
                  current.judgeVerdict?.["Requirement Satisfaction Status"]?.[i];
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs"
                  >
                    {verdict === "yes" ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : verdict === "no" ? (
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground">·</span>
                    )}
                    <span>
                      <span className="font-mono text-[10px] text-muted-foreground mr-1">
                        {i + 1}.
                      </span>
                      {r}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {current?.reasonerAnswer && (
            <Section title="Reasoner answer">
              <ScrollArea className="max-h-[220px] rounded-md border bg-card/40 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                  {current.reasonerAnswer}
                </pre>
              </ScrollArea>
            </Section>
          )}

          {current?.judgeVerdict?.["Grading Rationale"] && (
            <Section title="Judge rationale">
              <ScrollArea className="max-h-[220px] rounded-md border bg-card/40 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                  {current.judgeVerdict["Grading Rationale"]}
                </pre>
              </ScrollArea>
            </Section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}
