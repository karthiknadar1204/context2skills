export type ProposalForGenerator = {
  action: "create" | "edit";
  target_skill: string | null;
  analysis: string;
  skill_name: string;
  skill_description: string;
  proposed_skill: string;
  justification: string;
};

function serializeProposal(p: ProposalForGenerator): string {
  return `action: ${p.action}
target_skill: ${p.target_skill ?? "null"}
skill_name: ${p.skill_name}
skill_description: ${p.skill_description}

analysis:
${p.analysis}

proposed_skill:
${p.proposed_skill}

justification:
${p.justification}`;
}

export function buildReasonerGeneratorPrompt(opts: {
  proposal: ProposalForGenerator;
  existingSkills: string;
}): string {
  const existingSkillsBlock = opts.existingSkills.trim() || "(no skills yet)";

  return `You are an expert skill developer. Your job is to implement a concrete, actionable SKILL.md for a Reasoner agent based on a proposal from the Proposer.

## Context
The Reasoner agent receives conversation contexts + a batch of tasks and must produce responses satisfying all evaluation rubrics for each task. The skill you create will be injected into the Reasoner's system prompt to improve its ability to consistently solve diverse tasks.

## Implementation Rules
1. Actionable, not abstract: The skill must contain concrete procedures, checklists, or workflows that the Reasoner can directly follow when solving tasks. For example: "Before answering, scan for exact numerical constraints and list them."
2. Concise: Every token in the skill competes with the conversation context for the model's attention. Challenge each sentence: "Does this add actionable value?" Remove filler.
3. Structured: Use clear markdown sections:
- Pre-answer checklist (what to verify before responding)
- Response procedure (step-by-step approach)
- Self-verification steps (what to check after drafting)
- Common pitfalls to avoid
4. YAML frontmatter: The SKILL.md MUST start with a YAML frontmatter block containing ONLY these two fields:
---
skill_name: short-kebab-case-name
skill_description: One-sentence description of when to apply this skill
---
Do NOT include any other fields (no title, name, description, tags, or any other keys).
5. Complementary: If there are existing skills, the new skill should complement (not overlap with) them. Reference existing skills where relevant.
6. Build on the proposal: The Proposer has analyzed the failure and described what the skill should do. Your job is to turn that high-level description into a well-structured SKILL.md.

## Output Format
Output ONLY valid JSON:
{
  "skill_content": "The complete SKILL.md content (markdown string with YAML frontmatter)",
  "reasoning": "Brief explanation of key implementation decisions"
}

---

## Skill Proposal
${serializeProposal(opts.proposal)}

## Existing Skills
${existingSkillsBlock}

Implement the skill as a complete SKILL.md. Output ONLY the JSON object.`;
}

export function buildChallengerGeneratorPrompt(opts: {
  proposal: ProposalForGenerator;
  existingSkills: string;
}): string {
  const existingSkillsBlock = opts.existingSkills.trim() || "(no skills yet)";

  return `You are an expert skill developer. Your job is to implement a concrete, actionable SKILL.md for a Challenger agent based on a proposal from the Proposer.

## Context
The Challenger agent generates batches of evaluation tasks (each with its own rubrics) for conversation contexts. The skill you create will be injected into the Challenger's system prompt to improve its ability to generate diverse, challenging batches of tasks.

## Implementation Rules
1. Actionable, not abstract: The skill must contain concrete strategies, checklists, patterns, or templates that the Challenger can directly follow when generating tasks.
2. Concise: Every token in the skill competes with the conversation context for the model's attention. Challenge each sentence: "Does this add actionable value?" Remove filler.
3. Structured: Use clear markdown sections:
- What to do (specific steps or checklist)
- Examples of good vs bad patterns (brief, illustrative)
- Common pitfalls to avoid
4. YAML frontmatter: The SKILL.md MUST start with a YAML frontmatter block containing ONLY these two fields:
---
skill_name: short-kebab-case-name
skill_description: One-sentence description of when to apply this skill
---
Do NOT include any other fields (no title, name, description, tags, or any other keys).
5. Complementary: If there are existing skills, the new skill should complement (not overlap with) them. Reference existing skills where relevant.
6. Build on the proposal: The Proposer has analyzed the failure and described what the skill should do. Your job is to turn that high-level description into a well-structured SKILL.md.

## Output Format
Output ONLY valid JSON:
{
  "skill_content": "The complete SKILL.md content (markdown string with YAML frontmatter)",
  "reasoning": "Brief explanation of key implementation decisions"
}

---

## Skill Proposal
${serializeProposal(opts.proposal)}

## Existing Skills
${existingSkillsBlock}

Implement the skill as a complete SKILL.md. Output ONLY the JSON object.`;
}
