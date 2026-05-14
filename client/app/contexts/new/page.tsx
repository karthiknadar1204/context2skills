"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Wand2 } from "lucide-react";

const EXAMPLE = {
  systemPrompt: `You are SupportBot v2 for Acme Robotics' RoboArm-X1.
STRICT RULES:
(1) Every response MUST start with [TICKET-OPEN] on its own line.
(2) Every response MUST end with [TICKET-CLOSE] on its own line.
(3) Body MUST be exactly 3 numbered steps.
(4) Never use the words 'maybe' or 'perhaps'.
(5) Cite the relevant manual section in parentheses at the end of EACH step, e.g. (§4.2).`,
  content: `RoboArm-X1 Quick Manual (v3.1):
§1 Power: Press the green panel button for 2 seconds. LED turns blue when ready.
§2 Emergency stop: Slam the red mushroom button. Locks joints; manual unlock via Allen key at port J2.
§3 Calibration: Settings > Joints > Auto-Calibrate. Takes 90s. Arm must be in home position first.
§4 Joint limits: Shoulder ±170°, Elbow 0°-145°, Wrist ±360°, Gripper 0-50N.
§4.2 Wrist: continuous rotation; counter-rotates after 3 turns.
§5 Faults: F-12=motor overheat (wait 5min), F-23=encoder miscount (recalibrate), F-44=brake failure (DO NOT use, contact Acme).
§6 Maintenance: Lubricate every 500 hours.
§7 Network: 192.168.4.1, port 8443 HTTPS.
§8 Updates: USB-C only; NEVER over network.
§9 Safety: Max 12kg payload. 5C-40C.`,
};

export default function NewContextPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.createContext({ content, systemPrompt }),
    onSuccess: (data) => {
      toast.success("Context created");
      qc.invalidateQueries({ queryKey: ["contexts"] });
      router.push(`/contexts/${data.contextId}`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New Context</h2>
        <p className="text-sm text-muted-foreground">
          The Reasoner will learn from this content. The system prompt sets the
          persona and any hard rules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                Manuals, papers, transcripts — whatever the model needs to learn.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setSystemPrompt(EXAMPLE.systemPrompt);
                setContent(EXAMPLE.content);
              }}
            >
              <Wand2 className="mr-1 h-4 w-4" />
              Fill example
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt (optional)</Label>
            <Textarea
              id="systemPrompt"
              rows={6}
              placeholder='e.g. "You are a tech-support agent. Always respond in numbered steps..."'
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              rows={14}
              placeholder="The full text the Reasoner should learn from."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {content.length} chars
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/">Cancel</Link>
        </Button>
        <Button
          disabled={!content.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating…" : "Create Context"}
        </Button>
      </div>
    </div>
  );
}
