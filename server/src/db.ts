import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH ?? "data/ctx2skill.db";

export const db = new Database(DB_PATH, { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA synchronous = NORMAL");

db.run(`
  CREATE TABLE IF NOT EXISTS contexts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS iterations (
    context_id TEXT NOT NULL,
    iter_num INTEGER NOT NULL,
    challenger_skills TEXT NOT NULL DEFAULT '',
    reasoner_skills TEXT NOT NULL DEFAULT '',
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (context_id, iter_num),
    FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    context_id TEXT NOT NULL,
    iter_num INTEGER NOT NULL,
    task_text TEXT NOT NULL,
    rubrics_json TEXT NOT NULL,
    reasoner_answer TEXT,
    judge_verdicts TEXT,
    solved INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_context_iter
    ON tasks(context_id, iter_num);

  CREATE TABLE IF NOT EXISTS probe_sets (
    context_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('hard','easy')),
    iter_num INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    PRIMARY KEY (context_id, kind, iter_num),
    FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS final_skills (
    context_id TEXT PRIMARY KEY,
    selected_iter INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
  );
`);

export type ContextRow = {
  id: string;
  content: string;
  system_prompt: string;
  created_at: number;
};

export type IterationRow = {
  context_id: string;
  iter_num: number;
  challenger_skills: string;
  reasoner_skills: string;
  completed_at: number;
};

export const insertContext = db.prepare<
  void,
  [string, string, string, number]
>(`INSERT INTO contexts (id, content, system_prompt, created_at)
   VALUES (?, ?, ?, ?)`);

export const getContextById = db.prepare<ContextRow, [string]>(
  `SELECT id, content, system_prompt, created_at FROM contexts WHERE id = ?`,
);

export type ContextListRow = {
  id: string;
  created_at: number;
  content_preview: string;
  has_final_skills: number;
};

export const listContexts = db.prepare<ContextListRow, []>(
  `SELECT c.id,
          c.created_at,
          substr(c.content, 1, 200) AS content_preview,
          CASE WHEN fs.context_id IS NOT NULL THEN 1 ELSE 0 END AS has_final_skills
   FROM contexts c
   LEFT JOIN final_skills fs ON c.id = fs.context_id
   ORDER BY c.created_at DESC`,
);

export const upsertIteration = db.prepare<
  void,
  [string, number, string, string, number]
>(`INSERT INTO iterations (context_id, iter_num, challenger_skills, reasoner_skills, completed_at)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(context_id, iter_num) DO UPDATE SET
     challenger_skills = excluded.challenger_skills,
     reasoner_skills   = excluded.reasoner_skills,
     completed_at      = excluded.completed_at`);

export const listIterations = db.prepare<IterationRow, [string]>(
  `SELECT context_id, iter_num, challenger_skills, reasoner_skills, completed_at
   FROM iterations WHERE context_id = ? ORDER BY iter_num ASC`,
);

export type TaskRow = {
  id: number;
  context_id: string;
  iter_num: number;
  task_text: string;
  rubrics_json: string;
  reasoner_answer: string | null;
  judge_verdicts: string | null;
  solved: number;
};

export const insertTask = db.prepare<
  { lastInsertRowid: number; changes: number },
  [string, number, string, string]
>(`INSERT INTO tasks (context_id, iter_num, task_text, rubrics_json)
   VALUES (?, ?, ?, ?)`);

export const updateTaskAnswer = db.prepare<void, [string, number]>(
  `UPDATE tasks SET reasoner_answer = ? WHERE id = ?`,
);

export const updateTaskVerdict = db.prepare<void, [string, number, number]>(
  `UPDATE tasks SET judge_verdicts = ?, solved = ? WHERE id = ?`,
);

export const listTasksForContext = db.prepare<TaskRow, [string]>(
  `SELECT id, context_id, iter_num, task_text, rubrics_json,
          reasoner_answer, judge_verdicts, solved
   FROM tasks WHERE context_id = ? ORDER BY iter_num ASC, id ASC`,
);

export type ProbeRow = {
  context_id: string;
  kind: "hard" | "easy";
  iter_num: number;
  task_id: number;
  task_text: string;
  rubrics_json: string;
};

export const upsertProbe = db.prepare<
  void,
  [string, "hard" | "easy", number, number]
>(`INSERT INTO probe_sets (context_id, kind, iter_num, task_id)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(context_id, kind, iter_num) DO UPDATE SET
     task_id = excluded.task_id`);

export const listProbesByKind = db.prepare<ProbeRow, [string, "hard" | "easy"]>(
  `SELECT p.context_id, p.kind, p.iter_num, p.task_id,
          t.task_text, t.rubrics_json
   FROM probe_sets p
   JOIN tasks t ON t.id = p.task_id
   WHERE p.context_id = ? AND p.kind = ?
   ORDER BY p.iter_num ASC`,
);

export type FinalSkillRow = {
  context_id: string;
  selected_iter: number;
  content: string;
  created_at: number;
};

export const upsertFinalSkill = db.prepare<
  void,
  [string, number, string, number]
>(`INSERT INTO final_skills (context_id, selected_iter, content, created_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(context_id) DO UPDATE SET
     selected_iter = excluded.selected_iter,
     content       = excluded.content,
     created_at    = excluded.created_at`);

export const getFinalSkill = db.prepare<FinalSkillRow, [string]>(
  `SELECT context_id, selected_iter, content, created_at
   FROM final_skills WHERE context_id = ?`,
);

console.log(`[db] opened ${DB_PATH}`);
