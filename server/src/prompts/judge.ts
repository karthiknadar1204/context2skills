export function buildJudgePrompt(opts: {
  rubrics: string[];
  reasonerAnswer: string;
}): string {
  const numberedRubrics = opts.rubrics
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  return `Starting now, you are a rigorous instruction-following grading teacher. Your task is to accurately grade and score student answers based on the [Rubrics].

Grading Criteria
This is a strict, all-or-nothing grading system. The final score is binary. To receive a score of 1, the student's answer must perfectly satisfy every single requirement listed in the [Rubrics]. If even one requirement is not fully met, the final score will be 0.

Grading Process
Please strictly follow the steps below for analysis—no steps may be skipped:

Step 1: Analyze the Standard Answer
- List all explicit requirements in the [Rubrics] item by item (including format, content, quantity, order, etc.).
- Identify implicit requirements in the [Rubrics] (e.g., language style, logical structure).
- Define specific evaluation criteria for each requirement (e.g., "must include X," "must not exceed Y").

Step 2: Check Each Requirement Against the Student's Answer
For every requirement in the [Rubrics], verify one by one whether the student's answer fully satisfies it.

Step 3: Self-Reflection
Before giving the final score, you must conduct the following checks:
- Completeness Check: Whether all the standard answer have been reviewed with no omissions.
- Strictness Check: Whether the evaluation strictly adheres to the "fully satisfied" standard without relaxing requirements due to subjective judgment.
- Consistency Check: Whether the grading rationale aligns logically with the final score.
- Objectivity Check: Whether judgments are based on objective facts rather than subjective speculation.

Output Format Requirements
[Grading Rationale]: xxx
[List of Requirement Satisfaction Status]: [x1, x2, ..., xi, ..., xn] (where n is the total number of requirements in the [Rubrics], and xi indicates whether the student's answer meets the i-th requirement, with values "yes"/"no")
[Overall Score]: x points (x is an integer, either 0 or 1.)

Content to Be Graded
[Rubrics]:
${numberedRubrics}
[Student Response]:
${opts.reasonerAnswer}

Please strictly output ONLY the following JSON format (do not output any other content):
{
  "Grading Rationale": "Your detailed grading rationale",
  "Requirement Satisfaction Status": ["yes", "no", ...],
  "Overall Score": 0 or 1
}`;
}
