import { listIterations, listProbesByKind, type ProbeRow } from "./db";
import { runReasoner } from "./agents/reasoner";
import { runJudge } from "./agents/judge";

export type IterScore = {
  iter: number;
  rhoH: number;
  rhoE: number;
  score: number;
  hardPassed: number;
  hardTotal: number;
  easyPassed: number;
  easyTotal: number;
};

export type ReplayResult = {
  selectedIter: number;
  selectedSkills: string;
  scoresByIter: IterScore[];
  tokensUsed: number;
  hardProbeCount: number;
  easyProbeCount: number;
};

/**
 * Cross-Time Replay (paper §3.4):
 *   For each candidate iteration i, re-run the Reasoner with that iteration's
 *   skill set on every probe task (Q_h ∪ Q_e) and re-judge. Compute
 *     ρ_h(i) = (passes in Q_h + 1) / (|Q_h| + 1)
 *     ρ_e(i) = (passes in Q_e + 1) / (|Q_e| + 1)
 *   Select argmax_i (ρ_h(i) · ρ_e(i)) as the final skill set.
 *
 * Returns the selected iteration, its skill content, per-iter scores, and
 * total tokens spent during replay.
 */
export async function crossTimeReplay(opts: {
  contextId: string;
  context: string;
  systemPrompt: string;
}): Promise<ReplayResult> {
  const iterations = listIterations.all(opts.contextId);
  if (iterations.length === 0) {
    throw new Error(
      `crossTimeReplay: no iterations found for context ${opts.contextId}`,
    );
  }

  const hardProbes = listProbesByKind.all(opts.contextId, "hard");
  const easyProbes = listProbesByKind.all(opts.contextId, "easy");
  const allProbes: ProbeRow[] = [...hardProbes, ...easyProbes];

  console.log(
    `[replay] context=${opts.contextId} candidates=${iterations.length} ` +
      `hardProbes=${hardProbes.length} easyProbes=${easyProbes.length}`,
  );

  // Edge case: no probes were ever collected (e.g., every iteration had
  // either all-pass or all-fail with no usable signal). Fall back to last
  // iter's skills — no signal to discriminate.
  if (allProbes.length === 0) {
    const last = iterations[iterations.length - 1]!;
    console.log(
      `[replay] no probes collected — falling back to last iter ${last.iter_num}`,
    );
    return {
      selectedIter: last.iter_num,
      selectedSkills: last.reasoner_skills,
      scoresByIter: [],
      tokensUsed: 0,
      hardProbeCount: 0,
      easyProbeCount: 0,
    };
  }

  let tokensUsed = 0;
  const scoresByIter: IterScore[] = [];

  for (const candidate of iterations) {
    // Re-run Reasoner on every probe task using THIS candidate's skill set
    const reasonerResults = await Promise.all(
      allProbes.map((probe) =>
        runReasoner({
          context: opts.context,
          systemPrompt: opts.systemPrompt,
          task: probe.task_text,
          reasonerSkills: candidate.reasoner_skills,
        }),
      ),
    );

    // Re-judge against the original rubrics
    const judgeResults = await Promise.all(
      allProbes.map((probe, k) =>
        runJudge({
          rubrics: JSON.parse(probe.rubrics_json) as string[],
          reasonerAnswer: reasonerResults[k]!.answer,
        }),
      ),
    );

    let hardPassed = 0;
    let easyPassed = 0;
    for (let k = 0; k < allProbes.length; k++) {
      const isHard = k < hardProbes.length;
      const score = judgeResults[k]!.parsed["Overall Score"];
      tokensUsed +=
        reasonerResults[k]!.usage.totalTokens +
        judgeResults[k]!.usage.totalTokens;
      if (score === 1) {
        if (isHard) hardPassed++;
        else easyPassed++;
      }
    }

    // Laplace smoothing (per paper Eq.3): keeps product well-defined
    // when a probe set is empty.
    const rhoH = (hardPassed + 1) / (hardProbes.length + 1);
    const rhoE = (easyPassed + 1) / (easyProbes.length + 1);
    const score = rhoH * rhoE;

    scoresByIter.push({
      iter: candidate.iter_num,
      rhoH,
      rhoE,
      score,
      hardPassed,
      hardTotal: hardProbes.length,
      easyPassed,
      easyTotal: easyProbes.length,
    });

    console.log(
      `[replay] iter ${candidate.iter_num}: ` +
        `hard=${hardPassed}/${hardProbes.length} easy=${easyPassed}/${easyProbes.length} ` +
        `ρh=${rhoH.toFixed(3)} ρe=${rhoE.toFixed(3)} score=${score.toFixed(4)}`,
    );
  }

  // argmax with first-wins tiebreaker
  let best = scoresByIter[0]!;
  for (const s of scoresByIter) {
    if (s.score > best.score) best = s;
  }

  const selected = iterations.find((it) => it.iter_num === best.iter)!;
  console.log(
    `[replay] SELECTED iter ${best.iter} (score=${best.score.toFixed(4)})`,
  );

  return {
    selectedIter: best.iter,
    selectedSkills: selected.reasoner_skills,
    scoresByIter,
    tokensUsed,
    hardProbeCount: hardProbes.length,
    easyProbeCount: easyProbes.length,
  };
}
