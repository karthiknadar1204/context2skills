"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { InferenceJobReturn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Split } from "lucide-react";

function InferenceResult({
  title,
  data,
  loading,
  useSkillsExpected,
}: {
  title: string;
  data: InferenceJobReturn | null;
  loading: boolean;
  useSkillsExpected: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {loading ? (
            <Badge variant="secondary">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Running
            </Badge>
          ) : data ? (
            useSkillsExpected && data.usedSkills ? (
              <Badge>
                <Sparkles className="mr-1 h-3 w-3" />
                iter {data.selectedIter} skills
              </Badge>
            ) : (
              <Badge variant="outline">No skills</Badge>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] rounded-md border bg-card/40 p-3">
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            </div>
          ) : data ? (
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {data.answer}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              No response yet.
            </p>
          )}
        </ScrollArea>
        {data && (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
            <span>{data.usage.totalTokens} tok</span>
            <span>{data.model}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function useInferenceRunner(contextId: string) {
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    useSkillsExpected: boolean;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: { task: string; useSkills: boolean }) => {
      const resp = await api.startInference({
        contextId,
        task: input.task,
        useSkills: input.useSkills,
      });
      setActiveJob({ jobId: resp.jobId, useSkillsExpected: input.useSkills });
      return resp;
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const jobQuery = useQuery({
    queryKey: ["inferJob", activeJob?.jobId],
    queryFn: () => api.getInferenceJob(activeJob!.jobId),
    enabled: !!activeJob,
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "completed" || s === "failed" ? false : 1500;
    },
  });

  const job = jobQuery.data;
  const loading =
    mutation.isPending ||
    (!!activeJob && (!job || job.state === "active" || job.state === "waiting"));

  return {
    run: mutation.mutate,
    reset: () => setActiveJob(null),
    data: job?.returnvalue ?? null,
    loading,
    useSkillsExpected: activeJob?.useSkillsExpected ?? true,
  };
}

export function InferencePanel({ contextId }: { contextId: string }) {
  const [task, setTask] = useState("");
  const baseline = useInferenceRunner(contextId);
  const withSkills = useInferenceRunner(contextId);

  const runBoth = () => {
    if (!task.trim()) return;
    baseline.run({ task, useSkills: false });
    withSkills.run({ task, useSkills: true });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Try It</CardTitle>
          <CardDescription>
            Run the same task with and without the trained skill set to compare
            outputs side by side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task">Task</Label>
            <Textarea
              id="task"
              rows={3}
              placeholder="e.g. A user reports fault F-23 right after calibration."
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runBoth} disabled={!task.trim() || baseline.loading || withSkills.loading}>
              <Split className="mr-1 h-4 w-4" />
              Run A/B comparison
            </Button>
            <Button
              variant="outline"
              onClick={() => withSkills.run({ task, useSkills: true })}
              disabled={!task.trim() || withSkills.loading}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              With skills only
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <InferenceResult
          title="Baseline (no skills)"
          data={baseline.data}
          loading={baseline.loading}
          useSkillsExpected={false}
        />
        <InferenceResult
          title="With trained skills"
          data={withSkills.data}
          loading={withSkills.loading}
          useSkillsExpected={true}
        />
      </div>
    </div>
  );
}
