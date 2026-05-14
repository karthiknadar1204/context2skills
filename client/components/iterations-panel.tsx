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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownViewer } from "./markdown-viewer";
import { Layers, PackageOpen } from "lucide-react";

export function IterationsPanel({ contextId }: { contextId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["iterations", contextId],
    queryFn: () => api.listIterations(contextId),
    refetchInterval: 5000,
  });

  const [selected, setSelected] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No iterations yet — kick off training to see snapshots here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const current =
    selected !== null
      ? data.find((d) => d.iterNum === selected)
      : data[data.length - 1];

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4" />
            Iterations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-2 pb-2">
          {data.map((it) => {
            const active = (current?.iterNum ?? -1) === it.iterNum;
            return (
              <button
                key={it.iterNum}
                onClick={() => setSelected(it.iterNum)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <span className="font-mono">iter {it.iterNum}</span>
                <Badge variant="outline" className="text-[10px]">
                  R {it.reasonerSkills.length}c · C {it.challengerSkills.length}c
                </Badge>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>iter {current?.iterNum}</CardTitle>
          <CardDescription>
            Snapshots of each side's cheat sheet at the end of this iteration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="reasoner" className="w-full">
            <TabsList>
              <TabsTrigger value="reasoner">Reasoner skills</TabsTrigger>
              <TabsTrigger value="challenger">Challenger skills</TabsTrigger>
            </TabsList>
            <TabsContent value="reasoner">
              <ScrollArea className="h-[500px] rounded-md border p-4">
                {current?.reasonerSkills ? (
                  <MarkdownViewer content={current.reasonerSkills} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No Reasoner skills at this iteration.
                  </p>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="challenger">
              <ScrollArea className="h-[500px] rounded-md border p-4">
                {current?.challengerSkills ? (
                  <MarkdownViewer content={current.challengerSkills} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No Challenger skills at this iteration.
                  </p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
