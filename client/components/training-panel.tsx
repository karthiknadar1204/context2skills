"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TrainingJobState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Play, XCircle, Cpu } from "lucide-react";

function fmtTokens(n: number) {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function PhaseLabel({ phase }: { phase?: string }) {
  if (!phase || phase === "0") return null;
  const labels: Record<string, string> = {
    reasoning: "Reasoner answering",
    judging: "Judge scoring",
    skill_evolution: "Proposer + Generator updating skills",
    iter_done: "Iteration complete",
    cross_time_replay: "Cross-Time Replay",
    done: "Done",
  };
  return <span>{labels[phase] ?? phase}</span>;
}

export function TrainingPanel({ contextId }: { contextId: string }) {
  const qc = useQueryClient();
  const [N, setN] = useState(3);
  const [M, setM] = useState(3);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Restore active job from localStorage after refresh
  useEffect(() => {
    const stored = localStorage.getItem(`activeJob:${contextId}`);
    if (stored) setActiveJobId(stored);
  }, [contextId]);

  const startMutation = useMutation({
    mutationFn: () => api.startTraining(contextId, { N, M }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      localStorage.setItem(`activeJob:${contextId}`, data.jobId);
      toast.success(`Training job ${data.jobId} started`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const jobQuery = useQuery<TrainingJobState>({
    queryKey: ["trainJob", activeJobId],
    queryFn: () => api.getTrainingJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "completed" || s === "failed" ? false : 2500;
    },
  });

  // When job finishes, invalidate all per-context queries so other tabs refresh
  useEffect(() => {
    const s = jobQuery.data?.state;
    if (s === "completed" || s === "failed") {
      qc.invalidateQueries({ queryKey: ["iterations", contextId] });
      qc.invalidateQueries({ queryKey: ["tasks", contextId] });
      qc.invalidateQueries({ queryKey: ["probes", contextId] });
      qc.invalidateQueries({ queryKey: ["finalSkills", contextId] });
      qc.invalidateQueries({ queryKey: ["contexts"] });
      if (s === "completed") {
        toast.success(`Training job ${activeJobId} completed`);
      } else {
        toast.error(`Training job ${activeJobId} failed`);
      }
    }
  }, [jobQuery.data?.state, activeJobId, contextId, qc]);

  const job = jobQuery.data;
  const progress = typeof job?.progress === "object" ? job.progress : null;
  const result = job?.returnvalue;
  const running = job?.state === "active" || job?.state === "waiting";
  const totalIters = progress?.totalIters ?? N;
  const currentIter = progress?.iter ?? 0;
  const pct = totalIters > 0 ? Math.min(100, (currentIter / totalIters) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Train Skills</CardTitle>
          <CardDescription>
            Run the self-play loop. N iterations × M tasks per iteration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="N">Iterations (N)</Label>
              <Input
                id="N"
                type="number"
                min={1}
                max={10}
                value={N}
                onChange={(e) => setN(Math.max(1, Math.min(10, +e.target.value || 1)))}
                disabled={running}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="M">Tasks per iter (M)</Label>
              <Input
                id="M"
                type="number"
                min={1}
                max={10}
                value={M}
                onChange={(e) => setM(Math.max(1, Math.min(10, +e.target.value || 1)))}
                disabled={running}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => startMutation.mutate()}
              disabled={running || startMutation.isPending}
            >
              {running ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Training…
                </>
              ) : (
                <>
                  <Play className="mr-1 h-4 w-4" />
                  Start Training
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              N={N}, M={M} typically takes ~{N * 30}-{N * 60}s and uses
              ~{N * 25}-{N * 40}k tokens.
            </p>
          </div>
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Job #{job.jobId}
                  {job.state === "active" && (
                    <Badge variant="secondary">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Running
                    </Badge>
                  )}
                  {job.state === "completed" && (
                    <Badge variant="default">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Completed
                    </Badge>
                  )}
                  {job.state === "failed" && (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Failed
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {progress?.phase && (
                    <span className="font-mono text-xs">
                      Phase: <PhaseLabel phase={progress.phase} />
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="flex items-center gap-1 justify-end">
                  <Cpu className="h-3 w-3" />
                  {fmtTokens(progress?.tokensUsedTotal ?? result?.tokensUsed ?? 0)}{" "}
                  tokens
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Iteration {currentIter} / {totalIters}
                </span>
                <span className="font-mono">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} />
            </div>

            {progress?.perIter && progress.perIter.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Per-iteration results
                  </h4>
                  <div className="grid gap-2">
                    {progress.perIter.map((it) => (
                      <div
                        key={it.iter}
                        className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">
                            iter {it.iter}
                          </span>
                          <Badge variant="outline">
                            {it.solved}/{it.total} solved
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {it.reasonerEvolved && (
                            <Badge variant="secondary" className="text-[10px]">
                              R evolved
                            </Badge>
                          )}
                          {it.challengerEvolved && (
                            <Badge variant="secondary" className="text-[10px]">
                              C evolved
                            </Badge>
                          )}
                          <span className="font-mono">
                            {fmtTokens(it.tokensUsed)} tok
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {result && result.replay && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cross-Time Replay
                  </h4>
                  <div className="text-sm">
                    Probes:{" "}
                    <span className="font-mono">
                      {result.replay.hardProbes} hard
                    </span>
                    {" + "}
                    <span className="font-mono">
                      {result.replay.easyProbes} easy
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    {result.replay.scoresByIter.map((s) => {
                      const selected = s.iter === result.selectedFinalSkillIter;
                      return (
                        <div
                          key={s.iter}
                          className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-xs ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "bg-card/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono">iter {s.iter}</span>
                            {selected && (
                              <Badge variant="default" className="text-[10px]">
                                selected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 font-mono text-muted-foreground">
                            <span>
                              hard {s.hardPassed}/{s.hardTotal}
                            </span>
                            <span>
                              easy {s.easyPassed}/{s.easyTotal}
                            </span>
                            <span className="text-foreground">
                              score {s.score.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {job.failedReason && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                {job.failedReason}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
