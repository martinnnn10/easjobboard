/**
 * Curated skill dictionary + extractor used for resume/JD matching.
 *
 * This is intentionally a maintained keyword list rather than an ML model: it
 * is deterministic, fast, offline, and easy to audit/extend. Add aliases so
 * common spellings collapse to one canonical skill (e.g. "js" -> "JavaScript").
 */

// Canonical skill -> list of surface forms to match (the canonical name is also
// matched automatically). Keep forms lowercase; matching is case-insensitive.
const SKILL_ALIASES: Record<string, string[]> = {
  // Software / general tech
  JavaScript: ["js", "ecmascript"],
  TypeScript: ["ts"],
  Python: [],
  Java: [],
  "C++": ["cpp"],
  "C#": ["c-sharp", "csharp"],
  Go: ["golang"],
  Rust: [],
  Ruby: [],
  PHP: [],
  Swift: [],
  Kotlin: [],
  "Node.js": ["node", "nodejs"],
  React: ["react.js", "reactjs"],
  "Next.js": ["nextjs"],
  "Vue.js": ["vue", "vuejs"],
  Angular: ["angularjs"],
  SQL: [],
  PostgreSQL: ["postgres"],
  MySQL: [],
  SQLite: [],
  MongoDB: ["mongo"],
  Redis: [],
  GraphQL: [],
  "REST API": ["rest", "restful"],
  Docker: [],
  Kubernetes: ["k8s"],
  AWS: ["amazon web services"],
  Azure: [],
  GCP: ["google cloud"],
  Terraform: [],
  "CI/CD": ["cicd", "continuous integration"],
  Git: [],
  Linux: [],
  HTML: ["html5"],
  CSS: ["css3"],
  Tailwind: ["tailwindcss"],
  "Machine Learning": ["ml"],
  "Data Analysis": ["data analytics"],
  Excel: [],
  Tableau: [],
  "Power BI": ["powerbi"],

  // Electrical / industrial automation (EAS's core staffing domain)
  PLC: ["programmable logic controller"],
  SCADA: [],
  HMI: ["human machine interface"],
  "Ladder Logic": [],
  "AutoCAD": ["auto cad"],
  "AutoCAD Electrical": [],
  SolidWorks: ["solid works"],
  "Allen-Bradley": ["allen bradley", "rockwell"],
  Siemens: [],
  "Control Systems": ["controls"],
  Robotics: [],
  Pneumatics: [],
  Hydraulics: [],
  "Motor Controls": [],
  "Electrical Troubleshooting": [],
  "Wiring": [],
  "Panel Building": ["panel wiring"],
  "Instrumentation": [],
  "VFD": ["variable frequency drive"],
  "Six Sigma": [],
  "Lean Manufacturing": ["lean"],
  OSHA: [],

  // Professional / soft
  "Project Management": [],
  Agile: [],
  Scrum: [],
  Leadership: [],
  "Customer Service": [],
  Sales: [],
  Recruiting: ["recruitment", "talent acquisition"],
  Accounting: [],
  Bilingual: [],
};

type CompiledSkill = { canonical: string; pattern: RegExp };

/**
 * Escapes regex metacharacters so skill surface forms (C++, C#, .NET, Node.js)
 * can be matched literally.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a matcher with symbol-aware boundaries. A plain \b fails around "+",
 * "#" and "." so we assert the neighbours are not skill-name characters.
 */
function compileForm(canonical: string, form: string): CompiledSkill {
  const boundaryChars = "A-Za-z0-9+#.";
  const pattern = new RegExp(
    `(?<![${boundaryChars}])${escapeRegExp(form)}(?![${boundaryChars}])`,
    "i",
  );
  return { canonical, pattern };
}

const COMPILED: CompiledSkill[] = Object.entries(SKILL_ALIASES).flatMap(
  ([canonical, aliases]) =>
    [canonical, ...aliases].map((form) => compileForm(canonical, form)),
);

/**
 * Returns the set of canonical skills mentioned in the given text, in the
 * dictionary's declared order (stable, deduplicated).
 */
export function extractSkills(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const { canonical, pattern } of COMPILED) {
    if (found.has(canonical)) continue;
    if (pattern.test(text)) found.add(canonical);
  }
  // Preserve dictionary declaration order for stable output.
  return Object.keys(SKILL_ALIASES).filter((skill) => found.has(skill));
}
