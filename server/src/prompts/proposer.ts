type TaskTrace = {
  index: number;
  task: string;
  rubrics: string[];
  rubricStatuses: ("yes" | "no")[];
  reasonerAnswer: string;
  judgeRationale: string;
  overallScore: 0 | 1;
};

function buildTraceBlock(traces: TaskTrace[], outcomeLabel: string): string {
  return traces
    .map((t) => {
      const rubricLines = t.rubrics
        .map((r, i) => {
          const status = t.rubricStatuses[i] ?? "unknown";
          return `  ${i + 1}. [${status}] ${r}`;
        })
        .join("\n");
      return `### [Task ${t.index}] (${outcomeLabel} — score=${t.overallScore})

Task:
${t.task}

Rubrics (with per-rubric pass/fail):
${rubricLines}

Reasoner Answer:
${t.reasonerAnswer}

Judge Rationale:
${t.judgeRationale}`;
    })
    .join("\n\n---\n\n");
}

export function buildReasonerProposerPrompt(opts: {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  failedTraces: TaskTrace[];
  existingSkills: string;
}): string {
  const conversationContext = opts.systemPrompt.trim()
    ? `### System Prompt\n${opts.systemPrompt}\n\n### Context Content\n${opts.context}`
    : opts.context;

  const allOverview = opts.allTraces
    .map(
      (t) =>
        `- Task ${t.index}: ${t.overallScore === 1 ? "PASSED" : "FAILED"} (${t.rubricStatuses.filter((s) => s === "yes").length}/${t.rubrics.length} rubrics passed)`,
    )
    .join("\n");

  const failedBlock = buildTraceBlock(opts.failedTraces, "FAILED");
  const existingSkillsBlock = opts.existingSkills.trim() || "(no skills yet)";

  return `You are an expert analyst specializing in language model reasoning evaluation. Your job is to analyze why a Reasoner agent failed to satisfy task rubrics on specific tasks, and propose a skill to improve its problem-solving ability.

## Context
The Reasoner receives a conversation context + a batch of tasks (each with its own rubrics) and must produce a response for each task satisfying all its rubrics. Each task is scored independently (0/1) by a Judge. You are given the tasks that the Reasoner FAILED (score = 0). Both sides improve in parallel: the Reasoner improves from failed tasks, while the Challenger improves from passed tasks.

## Analysis Process
Before proposing a skill, work through these steps:

### Step 1: Failure Diagnosis
Examine each failed task and classify the failure type:
- Content gap: The Reasoner missed information that exists in the context
- Format/structure error: Wrong output format, missing sections, incorrect organization
- Constraint violation: Exceeded word limit, wrong count, missed exact requirements
- Reasoning error: Incorrect logic, calculation, or inference
- Task misunderstanding: Misinterpreted what was being asked
- System prompt non-compliance: Ignored behavioral rules (persona, tone, forbidden content)

Also consider cross-task patterns:
- Are the failures correlated (same weakness across tasks) or diverse (different weaknesses)?
- Is the Reasoner consistently weak at one type of challenge?

### Step 2: Existing Skill Check
- Review the Reasoner's existing skills listed in the query
- Does any existing skill already cover this weakness?
- If yes, why did it fail? Should it be EDITED rather than replaced?

### Step 3: Root Cause Identification
- What is the common root cause across failed tasks?
- Is this a skill issue (doesn't know how) or an attention issue (didn't notice)?
- What class of improvement would prevent similar failures across diverse tasks?

## Skill Design Rules
1. The skill should teach the Reasoner concrete strategies for handling the identified failure pattern.
2. Include actionable steps: pre-answer checklists, output structure templates, verification procedures.
3. Build on (don't repeat) any existing skills the Reasoner already has.
4. The skill should generalize beyond this single context.
5. Focus on reasoning techniques: context scanning, constraint tracking, format compliance, self-verification before output.

## Anti-Patterns to Avoid
- DON'T propose a new skill if an existing one covers similar ground — propose an EDIT instead.
- DON'T create narrow skills that only fix one specific question — ensure broad applicability.
- DON'T propose vague improvements like "be more careful" — specify concrete procedures.

## Output Format
Output ONLY valid JSON:
{
  "action": "create or edit",
  "target_skill": null or "existing-skill-name",
  "analysis": "failure analysis with per-task breakdown",
  "skill_name": "short-kebab-case-name",
  "skill_description": "when to apply this skill",
  "proposed_skill": "High-level description of what the skill should do",
  "justification": "Why this skill addresses the identified gap, referencing specific failed tasks"
}

---

## Round ${opts.iter} Failure Analysis

### Conversation Context
${conversationContext}

### All Tasks Overview
${allOverview}

### Analysis Focus
The Challenger generated ${opts.m} tasks. The Reasoner FAILED ${opts.failedTraces.length} of them. Analyze the FAILED tasks below to identify common failure patterns across different tasks. Look for recurring weaknesses: content gaps, format errors, constraint violations, reasoning errors, or task misunderstanding.

### Detailed Traces for Analysis
${failedBlock}

### Existing Skills for Reasoner
${existingSkillsBlock}

Analyze the failure pattern and propose a skill improvement. Output ONLY the JSON object.`;
}

export function buildChallengerProposerPrompt(opts: {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  passedTraces: TaskTrace[];
  existingSkills: string;
}): string {
  const conversationContext = opts.systemPrompt.trim()
    ? `### System Prompt\n${opts.systemPrompt}\n\n### Context Content\n${opts.context}`
    : opts.context;

  const allOverview = opts.allTraces
    .map(
      (t) =>
        `- Task ${t.index}: ${t.overallScore === 1 ? "PASSED" : "FAILED"} (${t.rubricStatuses.filter((s) => s === "yes").length}/${t.rubrics.length} rubrics passed)`,
    )
    .join("\n");

  const passedBlock = buildTraceBlock(opts.passedTraces, "PASSED");
  const existingSkillsBlock = opts.existingSkills.trim() || "(no skills yet)";

  return `You are an expert analyst specializing in adversarial benchmark design. Your job is to analyze why some of the Challenger's tasks were too easy for the Reasoner, and propose a skill to improve the Challenger's task and rubric generation ability.

## Context
The Challenger generates a batch of tasks, each with its own rubrics, for a given conversation context. Each task is scored independently (0/1) by a Judge. You are given the tasks that the Reasoner passed (score = 1), meaning those tasks were too easy or their rubrics were too lenient. Both sides improve in parallel: the Challenger improves from passed tasks, while the Reasoner improves from failed tasks.

## Analysis Process
Before proposing a skill, work through these steps:

### Step 1: Failure Diagnosis
- Were the tasks too similar to each other, failing to test diverse aspects of the context?
- Were the rubrics too lenient, vague, or easy to satisfy by chance?
- Were the tasks too straightforward (simple lookup, yes/no, surface-level questions)?
- Did the rubrics fail to test deep understanding of the context?
- Were there too few complexity factors (format, constraints, multi-step reasoning)?
- Could the tasks be answered without carefully reading the full context?
- Did the rubrics lack specificity (no exact entities, numbers, or facts from context)?
- Was there insufficient variety in complexity factors across tasks?

### Step 2: Existing Skill Check
- Review the Challenger's existing skills listed in the query
- Does any existing skill already cover this weakness?
- If yes, why did it fail? Should it be EDITED rather than replaced?

### Step 3: Pattern Identification
- Is this a recurring failure pattern (e.g., always generating single-step tasks)?
- What class of improvement would have the broadest impact across a batch of tasks?

## Skill Design Rules
1. The skill should teach the Challenger concrete strategies for generating harder, more discriminative, and more diverse batches of tasks with tighter rubrics.
2. Include actionable checklists, anti-patterns, or templates — not generic advice.
3. Build on (don't repeat) any existing skills the Challenger already has.
4. The skill should generalize beyond this single failure case.
5. Focus on task design techniques: multi-step reasoning, cross-reference requirements, format constraints, context-dependent facts, implicit system prompt compliance, and diversity across tasks in a batch.

## Anti-Patterns to Avoid
- DON'T propose a new skill if an existing one covers similar ground — propose an EDIT instead.
- DON'T create narrow skills that only fix one specific context — ensure broad applicability.
- DON'T propose vague improvements like "make tasks harder" — specify HOW.

## Output Format
Output ONLY valid JSON:
{
  "action": "create or edit",
  "target_skill": null or "existing-skill-name",
  "analysis": "failure analysis",
  "skill_name": "short-kebab-case-name",
  "skill_description": "when to apply this skill",
  "proposed_skill": "High-level description of what the skill should do",
  "justification": "Why this skill addresses the identified gap, referencing specific failure evidence"
}

---

## Round ${opts.iter} Failure Analysis

### Conversation Context
${conversationContext}

### All Tasks Overview
${allOverview}

### Analysis Focus
The Challenger generated ${opts.m} tasks. The Reasoner PASSED ${opts.passedTraces.length} of them, meaning those tasks were too easy. Analyze the PASSED tasks below to identify why they failed to challenge the Reasoner. Look for patterns: were rubrics too lenient? Were tasks too straightforward? Were there not enough complexity factors? Was there insufficient diversity across tasks?

### Detailed Traces for Analysis
${passedBlock}

### Existing Skills for Challenger
${existingSkillsBlock}

Analyze the failure pattern and propose a skill improvement. Output ONLY the JSON object.`;
}

export type { TaskTrace };
