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
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownViewer } from "./markdown-viewer";
import { Award, PackageOpen } from "lucide-react";

export function FinalSkillsPanel({ contextId }: { contextId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["finalSkills", contextId],
    queryFn: () => api.getFinalSkills(contextId),
    refetchInterval: 5000,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-96" />;

  if (error || !data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No final skills yet</p>
          <p className="text-sm text-muted-foreground">
            Cross-Time Replay runs after training and picks the best iteration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Final selected skills
            </CardTitle>
            <CardDescription>
              These get prepended to the Reasoner's system prompt on every{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                /infer
              </code>{" "}
              call where{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                useSkills: true
              </code>
              .
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge>iter {data.selectedIter}</Badge>
            <span className="text-[10px] text-muted-foreground font-mono">
              {data.content.length} chars
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[560px] rounded-md border p-4">
          <MarkdownViewer content={data.content} />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
