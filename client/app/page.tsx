"use client";

import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  FilePlus2,
  PackageOpen,
} from "lucide-react";

function relTime(ms: number) {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["contexts"],
    queryFn: api.listContexts,
    refetchInterval: 10000,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Contexts</h2>
          <p className="text-sm text-muted-foreground">
            Each context can be trained to produce a reusable skill set.
          </p>
        </div>
        <Button asChild>
          <Link href="/contexts/new">
            <FilePlus2 className="mr-1 h-4 w-4" />
            New Context
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to reach the API. Make sure the server is running on
            localhost:3002. <br />
            <span className="text-xs opacity-70">{(error as Error).message}</span>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data && data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No contexts yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first context to start training skills.
              </p>
            </div>
            <Button asChild className="mt-2">
              <Link href="/contexts/new">
                <FilePlus2 className="mr-1 h-4 w-4" />
                Create Context
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((c) => (
            <Link key={c.id} href={`/contexts/${c.id}`} className="group">
              <Card className="h-full transition-all hover:border-foreground/30 hover:shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-mono text-xs leading-relaxed break-all">
                      {c.id.slice(0, 13)}…{c.id.slice(-4)}
                    </CardTitle>
                    {c.hasFinalSkills ? (
                      <Badge variant="default" className="shrink-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Trained
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        <Circle className="mr-1 h-3 w-3" />
                        Untrained
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-3">
                    {c.contentPreview}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{relTime(c.createdAt)}</span>
                    <span className="flex items-center gap-1 text-foreground/70 group-hover:text-foreground transition-colors">
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
