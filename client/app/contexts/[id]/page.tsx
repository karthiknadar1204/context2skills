"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import { TrainingPanel } from "@/components/training-panel";
import { IterationsPanel } from "@/components/iterations-panel";
import { ProbesPanel } from "@/components/probes-panel";
import { FinalSkillsPanel } from "@/components/final-skills-panel";
import { InferencePanel } from "@/components/inference-panel";
import { TasksPanel } from "@/components/tasks-panel";

export default function ContextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: ctx, isLoading, error } = useQuery({
    queryKey: ["context", id],
    queryFn: () => api.getContext(id),
  });

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        <AlertDescription>
          Failed to load context. {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All contexts
          </Link>
        </Button>
      </div>

      {isLoading || !ctx ? (
        <Skeleton className="h-24" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm break-all">
              {ctx.id}
            </CardTitle>
            <CardDescription>
              Created {new Date(ctx.createdAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  System prompt
                </h4>
                <ScrollArea className="h-32 rounded-md border bg-card/40 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {ctx.systemPrompt || "(none)"}
                  </pre>
                </ScrollArea>
              </div>
              <div>
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Content
                </h4>
                <ScrollArea className="h-32 rounded-md border bg-card/40 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {ctx.content}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="training" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="iterations">Iterations</TabsTrigger>
          <TabsTrigger value="probes">Probes</TabsTrigger>
          <TabsTrigger value="final-skills">Final Skills</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="inference">Try It</TabsTrigger>
        </TabsList>
        <TabsContent value="training" className="mt-4">
          <TrainingPanel contextId={id} />
        </TabsContent>
        <TabsContent value="iterations" className="mt-4">
          <IterationsPanel contextId={id} />
        </TabsContent>
        <TabsContent value="probes" className="mt-4">
          <ProbesPanel contextId={id} />
        </TabsContent>
        <TabsContent value="final-skills" className="mt-4">
          <FinalSkillsPanel contextId={id} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksPanel contextId={id} />
        </TabsContent>
        <TabsContent value="inference" className="mt-4">
          <InferencePanel contextId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
