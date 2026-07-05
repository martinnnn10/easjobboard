/**
 * Manufacturing skills-screen templates.
 *
 * This is the core of EAS Recruit's differentiation: role-specific assessments
 * that test whether an applicant can actually troubleshoot, repair, and lead on
 * a plant floor — not whether their resume contains the right keywords.
 *
 * Templates live in code (not the database) so a job only stores a `screen_key`
 * reference. Answer keys, rubrics, and ideal points stay server-side; the public
 * application page only ever receives the stripped `PublicScreen` shape.
 */

export type ScreenKey =
  | "maintenance_tech"
  | "industrial_electrician"
  | "controls_tech"
  | "maintenance_leader";

/** The six competency dimensions a screen rolls answers up into. */
export type ScreenDimension =
  | "troubleshooting"
  | "electrical"
  | "mechanical"
  | "safety"
  | "roleAlignment"
  | "communication";

export const DIMENSION_LABELS: Record<ScreenDimension, string> = {
  troubleshooting: "Troubleshooting ability",
  electrical: "Electrical / control knowledge",
  mechanical: "Mechanical knowledge",
  safety: "Safety judgment",
  roleAlignment: "Role alignment",
  communication: "Communication clarity",
};

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "scenario"
  | "ranking"
  | "experience";

export type RankingItem = { id: string; text: string };

export type ScreenQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Primary competency this question measures. */
  dimension: ScreenDimension;
  /** Relative weight in the overall score. Troubleshooting/scenario weigh more. */
  weight: number;
  help?: string;

  // multiple_choice / experience
  options?: string[];
  /** Correct option index (multiple_choice). Server-side only. */
  correctIndex?: number;
  /**
   * Score per option for `experience` questions (0-100), index-aligned to
   * `options`. Server-side only.
   */
  optionScores?: number[];

  // short_answer / scenario — rubric-based scoring (server-side only)
  /** Human rubric shown to the AI grader. */
  rubric?: string;
  /**
   * Discrete points a strong answer demonstrates. Each point is a set of
   * synonym keywords; the offline grader credits a point if any synonym appears.
   */
  idealPoints?: { label: string; any: string[] }[];
  /** Interview follow-up to ask when this answer is weak. */
  followUpIfWeak?: string;

  // ranking — `items` are stored in the CORRECT order (server-side only)
  items?: RankingItem[];
};

export type ScreenTemplate = {
  key: ScreenKey;
  label: string;
  shortLabel: string;
  blurb: string;
  questions: ScreenQuestion[];
};

// ─── Maintenance Technician ────────────────────────────────────────────────
const MAINTENANCE_TECH: ScreenTemplate = {
  key: "maintenance_tech",
  label: "Maintenance Technician screen",
  shortLabel: "Maintenance Tech",
  blurb: "Tests hands-on electro-mechanical troubleshooting, PMs, and shop-floor safety.",
  questions: [
    {
      id: "mt_starter_trip",
      type: "scenario",
      dimension: "troubleshooting",
      weight: 2.5,
      prompt:
        "A motor starter trips immediately after you reset it. What are the first three things you check, and why?",
      rubric:
        "A strong answer names concrete first checks (short/ground in the motor or cabling, overload sizing/setting, mechanical bind/locked rotor, loose connections, correct voltage) and reflects a logical sequence. Reward specificity and reasoning; do not reward vague restatements or keyword lists.",
      idealPoints: [
        { label: "Shorted/grounded motor or cable", any: ["short", "ground", "megger", "insulation", "winding"] },
        { label: "Overload sizing / setting", any: ["overload", "heater", "sized", "setting", "amp"] },
        { label: "Mechanical bind / locked rotor", any: ["bind", "locked rotor", "seized", "jam", "mechanical", "load"] },
        { label: "Loose / bad connections", any: ["loose", "connection", "terminal", "wiring", "lug"] },
        { label: "Correct voltage / phase present", any: ["voltage", "phase", "supply", "power"] },
      ],
      followUpIfWeak: "Walk me through the last time a starter kept tripping on you — how did you find the cause?",
    },
    {
      id: "mt_conveyor_random",
      type: "multiple_choice",
      dimension: "troubleshooting",
      weight: 1.5,
      prompt: "A conveyor stops randomly but the overload is NOT tripped. What would you inspect first?",
      options: [
        "Intermittent connections, sensors, and safety interlocks (e-stops, guards, photoeyes)",
        "Immediately replace the drive motor",
        "Rewrite the PLC program from scratch",
        "Turn the overload setting up so it stops tripping",
      ],
      correctIndex: 0,
    },
    {
      id: "mt_manual_not_auto",
      type: "short_answer",
      dimension: "troubleshooting",
      weight: 2,
      prompt: "A machine runs in MANUAL but not in AUTO. What does that usually tell you?",
      rubric:
        "Strong answers recognize the power/motor/field devices are healthy (it runs in manual) so the fault is in the auto logic: an unsatisfied permissive, interlock, sensor, or mode/PLC condition. Reward that reasoning.",
      idealPoints: [
        { label: "Power/output side is proven good", any: ["manual works", "runs in manual", "output", "motor is fine", "power is good", "field device"] },
        { label: "Fault is in auto logic / permissives", any: ["permissive", "interlock", "logic", "auto", "condition", "sequence", "plc"] },
        { label: "A sensor / input not satisfied", any: ["sensor", "input", "photoeye", "prox", "switch", "signal"] },
      ],
      followUpIfWeak: "When something works in manual but not auto, where do you start looking and why?",
    },
    {
      id: "mt_slow_cylinder",
      type: "multiple_choice",
      dimension: "mechanical",
      weight: 1.5,
      prompt: "A pneumatic cylinder is moving noticeably slower than normal. What is the MOST likely cause?",
      options: [
        "The PLC scan time increased",
        "Restricted air: a flow control turned down, clogged muffler, kinked line, or low supply pressure",
        "A blown main electrical fuse",
        "The motor is rotating the wrong direction",
      ],
      correctIndex: 1,
    },
    {
      id: "mt_reactive_vs_pm",
      type: "short_answer",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "In your own words, what is the difference between reactive maintenance and preventive maintenance?",
      rubric:
        "Reactive = repair after a failure/breakdown; preventive = scheduled/planned work to prevent failures and reduce downtime. Reward a clear, correct distinction.",
      idealPoints: [
        { label: "Reactive = fix after failure", any: ["reactive", "after", "breakdown", "fail", "run to failure", "when it breaks"] },
        { label: "Preventive = scheduled/planned", any: ["preventive", "scheduled", "planned", "routine", "before", "prevent"] },
        { label: "Goal is less downtime", any: ["downtime", "uptime", "reliability", "avoid", "reduce"] },
      ],
      followUpIfWeak: "What PMs have you personally built or run, and how did you know they were working?",
    },
    {
      id: "mt_lockout_first",
      type: "multiple_choice",
      dimension: "safety",
      weight: 1.5,
      prompt: "Before reaching into a machine to clear a jam, you should first:",
      options: [
        "Be quick so the line keeps running",
        "Ask a coworker to hold the start button out",
        "Lock out and tag out the equipment and verify zero energy",
        "Leave it running so you can see what is jamming",
      ],
      correctIndex: 2,
    },
    {
      id: "mt_troubleshoot_order",
      type: "ranking",
      dimension: "troubleshooting",
      weight: 1.5,
      prompt: "Put these steps for troubleshooting a dead machine in the order you'd actually do them.",
      items: [
        { id: "verify", text: "Verify the complaint and observe the symptoms" },
        { id: "loto", text: "Lock out / tag out and verify zero energy where required" },
        { id: "power", text: "Check supply power and protective devices (fuses, breakers, overloads)" },
        { id: "inputs", text: "Inspect inputs, sensors, and wiring" },
        { id: "repair", text: "Test and repair the faulty component" },
        { id: "return", text: "Return to service and verify normal operation" },
      ],
    },
    {
      id: "mt_experience",
      type: "experience",
      dimension: "roleAlignment",
      weight: 1,
      prompt: "How many years have you worked hands-on in industrial maintenance (not facilities/janitorial)?",
      options: ["None", "Less than 1 year", "1–3 years", "3–7 years", "7+ years"],
      optionScores: [0, 35, 65, 85, 100],
    },
  ],
};

// ─── Industrial Electrician ────────────────────────────────────────────────
const INDUSTRIAL_ELECTRICIAN: ScreenTemplate = {
  key: "industrial_electrician",
  label: "Industrial Electrician screen",
  shortLabel: "Industrial Electrician",
  blurb: "Tests motor controls, VFDs, control-circuit troubleshooting, and electrical safety.",
  questions: [
    {
      id: "ie_vfd_oc",
      type: "scenario",
      dimension: "electrical",
      weight: 2.5,
      prompt: "A VFD faults on overcurrent at startup. What would you check, and in what order?",
      rubric:
        "Strong answers check for a shorted/grounded motor or cable (megger), mechanical bind/locked rotor/load, accel/ramp time set too short, current-limit/drive parameters, and loose connections. Reward a diagnostic sequence, not a single guess.",
      idealPoints: [
        { label: "Shorted/grounded motor or cable", any: ["short", "ground", "megger", "insulation", "cable", "motor lead"] },
        { label: "Mechanical bind / locked rotor / load", any: ["bind", "locked rotor", "load", "seized", "mechanical", "coupling"] },
        { label: "Accel/ramp too fast", any: ["accel", "ramp", "decel", "ramp time", "too fast"] },
        { label: "Drive parameters / current limit", any: ["parameter", "current limit", "setting", "config", "torque"] },
        { label: "Loose connections", any: ["loose", "connection", "terminal", "lug"] },
      ],
      followUpIfWeak: "Tell me about a VFD fault you actually chased down — what was the root cause?",
    },
    {
      id: "ie_overload_purpose",
      type: "multiple_choice",
      dimension: "electrical",
      weight: 1.5,
      prompt: "What is the primary purpose of a motor overload relay?",
      options: [
        "Protect the motor from sustained excess current / overheating",
        "Protect only against a dead short circuit",
        "Convert AC to DC for the motor",
        "Provide overspeed protection",
      ],
      correctIndex: 0,
    },
    {
      id: "ie_24vdc_no_output",
      type: "short_answer",
      dimension: "troubleshooting",
      weight: 2,
      prompt: "How would you troubleshoot a 24VDC control circuit that has no output?",
      rubric:
        "Strong answers describe a meter-in-hand, step-by-step trace: confirm the 24V supply/fuse is present, check the input signal/switch, follow the circuit through terminals/field wiring to the load/coil, and check the driving output/relay/PLC. Reward a logical sequence with a meter.",
      idealPoints: [
        { label: "Confirm 24V supply / fuse", any: ["supply", "power supply", "24v present", "fuse", "voltage present"] },
        { label: "Meter it step by step", any: ["meter", "measure", "trace", "voltmeter", "check voltage", "point to point"] },
        { label: "Check input / command", any: ["input", "switch", "signal", "command", "contact"] },
        { label: "Check field wiring / terminals", any: ["wiring", "terminal", "connection", "wire", "field"] },
        { label: "Check the load / coil / output", any: ["coil", "load", "relay", "output", "solenoid"] },
      ],
      followUpIfWeak: "Describe your exact meter sequence on a dead 24V circuit, from supply to load.",
    },
    {
      id: "ie_contactor_no_motor",
      type: "multiple_choice",
      dimension: "electrical",
      weight: 1.5,
      prompt: "A contactor pulls in (you hear it) but the motor does not run. The MOST likely cause is:",
      options: [
        "The control transformer is slightly undersized",
        "A lost phase or open on the load side — blown fuse, loose lug, or open overload",
        "The PLC lost communications",
        "The HMI needs to be rebooted",
      ],
      correctIndex: 1,
    },
    {
      id: "ie_panel_safety",
      type: "short_answer",
      dimension: "safety",
      weight: 2,
      prompt: "What safety steps do you take before working inside an energized electrical panel?",
      rubric:
        "Strong answers reference de-energizing/LOTO where possible, verifying zero energy with a meter (test-before-touch), arc-flash-rated PPE, insulated tools, and following NFPA 70E. Reward real, specific safety practice; a weak or cavalier answer is a serious red flag.",
      idealPoints: [
        { label: "De-energize / LOTO where possible", any: ["de-energize", "deenergize", "lockout", "loto", "tag out", "shut off"] },
        { label: "Verify zero energy / test before touch", any: ["verify", "test before touch", "zero energy", "meter", "confirm dead", "prove"] },
        { label: "Arc-flash-rated PPE", any: ["ppe", "arc flash", "arc-rated", "gloves", "face shield", "fr"] },
        { label: "Insulated tools / NFPA 70E", any: ["insulated", "70e", "nfpa", "rated tools"] },
      ],
      followUpIfWeak: "When is it acceptable to work on something live, and what changes about how you do it?",
    },
    {
      id: "ie_loto_order",
      type: "ranking",
      dimension: "safety",
      weight: 1.5,
      prompt: "Put the lockout/tagout steps in the correct order.",
      items: [
        { id: "notify", text: "Notify affected personnel" },
        { id: "shutdown", text: "Shut the equipment down by the normal stopping procedure" },
        { id: "isolate", text: "Isolate / disconnect the energy source" },
        { id: "lock", text: "Apply your lock and tag" },
        { id: "release", text: "Release or dissipate stored energy" },
        { id: "verify", text: "Verify zero energy — test before touch" },
      ],
    },
    {
      id: "ie_experience",
      type: "experience",
      dimension: "roleAlignment",
      weight: 1,
      prompt: "How many years of industrial electrical work do you have (480V three-phase, motor controls)?",
      options: ["None", "Less than 1 year", "1–3 years", "3–7 years", "7+ years"],
      optionScores: [0, 35, 65, 85, 100],
    },
  ],
};

// ─── Controls / PLC Technician ─────────────────────────────────────────────
const CONTROLS_TECH: ScreenTemplate = {
  key: "controls_tech",
  label: "Controls Technician screen",
  shortLabel: "Controls Technician",
  blurb: "Tests PLC/HMI/VFD troubleshooting, I/O reasoning, and working with logic online.",
  questions: [
    {
      id: "ct_photoeye_stuck",
      type: "scenario",
      dimension: "troubleshooting",
      weight: 2.5,
      prompt: "A photoeye input is stuck ON in the PLC. Walk me through what you'd check.",
      rubric:
        "Strong answers separate the sensor, the wiring, and the input card/PLC point: check alignment/lens/reflector and whether it's actually seeing a target, check for a shorted wire, compare the input card LED to the PLC status, check for a force, and verify light/dark operate. Reward isolating field vs. card vs. logic.",
      idealPoints: [
        { label: "Sensor alignment / lens / target", any: ["align", "lens", "reflector", "target", "dirty", "aim", "sensing"] },
        { label: "Wiring short / shorted signal", any: ["short", "wiring", "wire", "cable", "pinched"] },
        { label: "Compare card LED to PLC status", any: ["led", "card", "input card", "status", "indicator"] },
        { label: "Check for a force", any: ["force", "forced", "unforce"] },
        { label: "Light / dark operate setting", any: ["light operate", "dark operate", "light on", "dark on", "no", "nc"] },
      ],
      followUpIfWeak: "How do you decide whether a stuck input is the sensor, the wiring, or the card itself?",
    },
    {
      id: "ct_hmi_no_output",
      type: "short_answer",
      dimension: "troubleshooting",
      weight: 2,
      prompt: "The HMI Start button works but the motor output never energizes. What do you investigate?",
      rubric:
        "Strong answers go online to watch the logic, check permissives/interlocks/e-stops that aren't satisfied, check mode (auto/remote), look for a disabled/forced output, and then verify the physical output card, field wiring, and starter. Reward following the rung from command to output.",
      idealPoints: [
        { label: "Go online and watch the output rung", any: ["online", "watch", "rung", "logic", "monitor", "live"] },
        { label: "Unsatisfied permissive / interlock / e-stop", any: ["permissive", "interlock", "e-stop", "estop", "safety", "condition"] },
        { label: "Mode / auto / remote", any: ["mode", "auto", "remote", "hand", "manual", "local"] },
        { label: "Forced or disabled output", any: ["force", "disabled", "inhibit"] },
        { label: "Physical output card / wiring / starter", any: ["output card", "wiring", "starter", "field", "relay", "contactor"] },
      ],
      followUpIfWeak: "When a command is present but the output won't turn on, how do you use online logic to find why?",
    },
    {
      id: "ct_io_types",
      type: "multiple_choice",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "Which statement correctly describes an input, an output, an internal bit, and a timer?",
      options: [
        "They are all just physical relays wired in the panel",
        "Input = a field signal into the PLC; Output = a PLC signal driving a device; Internal bit = a memory/logic flag; Timer = a time-based instruction",
        "Inputs energize motors directly without an output",
        "They are all the same address type and interchangeable",
      ],
      correctIndex: 1,
    },
    {
      id: "ct_vfd_run_no_start",
      type: "scenario",
      dimension: "troubleshooting",
      weight: 2,
      prompt: "A VFD is receiving a run command but won't start. What possible causes would you check?",
      rubric:
        "Strong answers check for an active fault/needs reset, a missing enable or safety input, a zero speed reference, the drive being in Hand/Local instead of Auto/Remote, run-command wiring, and DC bus/power. Reward multiple plausible causes across drive, reference, and wiring.",
      idealPoints: [
        { label: "Active fault / needs reset", any: ["fault", "reset", "trip", "alarm"] },
        { label: "Missing enable / safety input", any: ["enable", "safety", "sto", "permissive", "interlock"] },
        { label: "Zero / missing speed reference", any: ["speed reference", "reference", "zero speed", "setpoint", "frequency command"] },
        { label: "Hand/Local vs Auto/Remote", any: ["local", "remote", "hand", "auto", "mode"] },
        { label: "Run command wiring / DC bus", any: ["wiring", "run command", "dc bus", "power", "terminal"] },
      ],
      followUpIfWeak: "Give me the last VFD that had a run command but wouldn't turn — what did it end up being?",
    },
    {
      id: "ct_online",
      type: "short_answer",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "What does it mean to troubleshoot ladder logic 'online'?",
      rubric:
        "Strong answers describe being connected to the running PLC and watching live bit/rung states in real time to see which conditions are true/false and find the false permissive — without necessarily downloading or changing code. Reward understanding of live monitoring.",
      idealPoints: [
        { label: "Connected to the running PLC", any: ["connected", "running plc", "live", "processor", "controller"] },
        { label: "Watch bit/rung states in real time", any: ["real time", "watch", "bit", "rung", "state", "true", "false", "highlight"] },
        { label: "Find the false permissive/condition", any: ["permissive", "condition", "why", "find", "trace", "logic"] },
      ],
      followUpIfWeak: "Which platforms have you gone online with (Allen-Bradley, Siemens, etc.) and how comfortable are you?",
    },
    {
      id: "ct_input_mismatch",
      type: "multiple_choice",
      dimension: "troubleshooting",
      weight: 1.5,
      prompt: "An input card's point LED is ON for a sensor, but the PLC logic shows that input OFF. The MOST likely issue is:",
      options: [
        "The gearbox is worn",
        "The motor is undersized",
        "A force, an addressing/mapping error, or a faulty input point on the card",
        "The HMI backlight is failing",
      ],
      correctIndex: 2,
    },
    {
      id: "ct_experience",
      type: "experience",
      dimension: "roleAlignment",
      weight: 1,
      prompt: "How many years have you spent troubleshooting PLCs, HMIs, and VFDs on production equipment?",
      options: ["None", "Less than 1 year", "1–3 years", "3–7 years", "7+ years"],
      optionScores: [0, 35, 65, 85, 100],
    },
  ],
};

// ─── Maintenance Supervisor / Manager ──────────────────────────────────────
const MAINTENANCE_LEADER: ScreenTemplate = {
  key: "maintenance_leader",
  label: "Maintenance Leader screen",
  shortLabel: "Maintenance Leader",
  blurb: "Tests reliability leadership, PM strategy, KPIs, and handling floor conflict.",
  questions: [
    {
      id: "ml_repeat_downtime",
      type: "short_answer",
      dimension: "roleAlignment",
      weight: 2,
      prompt: "A plant has repeated downtime on the same machine. What is your first leadership move?",
      rubric:
        "Strong answers get the data (downtime tracking), go see the asset (gemba), involve the techs and operators, run a real root-cause analysis, and prioritize by impact — rather than blaming people or throwing parts at it. Reward data-driven, people-inclusive leadership.",
      idealPoints: [
        { label: "Get the downtime data", any: ["data", "downtime", "track", "history", "cmms", "metrics"] },
        { label: "Root-cause analysis", any: ["root cause", "rca", "5 why", "why", "analysis"] },
        { label: "Go see it / involve the team", any: ["gemba", "go see", "floor", "team", "operators", "technicians", "involve"] },
        { label: "Prioritize by impact", any: ["prioritize", "impact", "critical", "biggest", "pareto"] },
      ],
      followUpIfWeak: "Tell me about a chronic bad actor you actually turned around — what did you do first?",
    },
    {
      id: "ml_pm_effective",
      type: "short_answer",
      dimension: "roleAlignment",
      weight: 2,
      prompt: "How do you decide whether a PM is effective or just wasted labor?",
      rubric:
        "Strong answers measure it: failure rates and downtime before vs. after, whether the PM actually catches or prevents failures, PM compliance vs. breakdowns, and cost vs. benefit — then adjust based on the data. Reward measurement and iteration.",
      idealPoints: [
        { label: "Measure failures/downtime before vs after", any: ["failure", "downtime", "before", "after", "trend", "reduce"] },
        { label: "Does it catch/prevent failures", any: ["catch", "prevent", "find", "detect", "avoid"] },
        { label: "Compliance vs breakdowns", any: ["compliance", "completed", "breakdown", "reactive"] },
        { label: "Cost vs benefit / adjust", any: ["cost", "benefit", "adjust", "optimize", "value", "roi"] },
      ],
      followUpIfWeak: "Give me a PM you killed or changed because the data said it wasn't working.",
    },
    {
      id: "ml_blame",
      type: "scenario",
      dimension: "communication",
      weight: 2,
      prompt:
        "A technician blames the operators and the operators blame maintenance for a recurring breakdown. How do you handle it?",
      rubric:
        "Strong answers get both sides together, focus on facts and data instead of blame, find the actual root cause, define clear ownership, and build a partnership (training, communication) with follow-up. Reward de-escalation plus a factual, ownership-driven resolution.",
      idealPoints: [
        { label: "Get both sides together / listen", any: ["together", "both", "listen", "meet", "conversation", "sides"] },
        { label: "Focus on facts/data, not blame", any: ["fact", "data", "not blame", "no blame", "objective", "evidence"] },
        { label: "Find root cause", any: ["root cause", "why", "actual cause", "real problem"] },
        { label: "Define ownership / build partnership", any: ["ownership", "responsibility", "partnership", "training", "accountable", "follow up"] },
      ],
      followUpIfWeak: "Describe a real conflict between your team and production and how you resolved it.",
    },
    {
      id: "ml_kpis",
      type: "multiple_choice",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "Which set of KPIs best reflects maintenance performance in your first 30 days?",
      options: [
        "Website traffic, email volume, and meeting count",
        "Revenue, gross margin, and headcount",
        "MTBF, MTTR, PM compliance, downtime, and schedule compliance",
        "Overtime hours only",
      ],
      correctIndex: 2,
    },
    {
      id: "ml_fix_reactive",
      type: "short_answer",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "How do you turn a purely reactive maintenance department into a proactive one?",
      rubric:
        "Strong answers build a PM program, stand up spares/CMMS, prioritize critical assets, plan and schedule work, train the team, track metrics, and shift the culture — often starting with quick wins on the worst offenders. Reward a realistic, staged plan.",
      idealPoints: [
        { label: "Build the PM program", any: ["pm program", "preventive", "pm", "predictive", "routine"] },
        { label: "Spares / CMMS / planning", any: ["cmms", "spare", "parts", "planning", "scheduling", "work order"] },
        { label: "Prioritize critical assets", any: ["critical", "prioritize", "criticality", "worst", "bad actor"] },
        { label: "Train the team / culture", any: ["train", "culture", "team", "develop", "buy-in", "coach"] },
        { label: "Track metrics / quick wins", any: ["metric", "kpi", "measure", "quick win", "track"] },
      ],
      followUpIfWeak: "What's the first 90 days of standing up a PM program look like for you, concretely?",
    },
    {
      id: "ml_first30_order",
      type: "ranking",
      dimension: "roleAlignment",
      weight: 1.5,
      prompt: "Order your first-30-days priorities taking over a struggling maintenance department.",
      items: [
        { id: "assess", text: "Assess the current state — walk the floor and review downtime data" },
        { id: "team", text: "Meet the team and build trust" },
        { id: "critical", text: "Identify critical assets and the top downtime drivers" },
        { id: "quickwin", text: "Stabilize with quick wins on the worst offenders" },
        { id: "pm", text: "Stand up or repair the PM program and CMMS" },
        { id: "kpi", text: "Set KPIs and a regular review cadence" },
      ],
    },
    {
      id: "ml_experience",
      type: "experience",
      dimension: "roleAlignment",
      weight: 1,
      prompt: "How many maintenance/reliability people have you directly supervised?",
      options: ["None", "1–3", "4–8", "9–20", "20+"],
      optionScores: [10, 45, 70, 90, 100],
    },
  ],
};

export const ROLE_SCREENS: Record<ScreenKey, ScreenTemplate> = {
  maintenance_tech: MAINTENANCE_TECH,
  industrial_electrician: INDUSTRIAL_ELECTRICIAN,
  controls_tech: CONTROLS_TECH,
  maintenance_leader: MAINTENANCE_LEADER,
};

export const SCREEN_OPTIONS: { key: ScreenKey; label: string; shortLabel: string; blurb: string }[] =
  (Object.keys(ROLE_SCREENS) as ScreenKey[]).map((key) => ({
    key,
    label: ROLE_SCREENS[key].label,
    shortLabel: ROLE_SCREENS[key].shortLabel,
    blurb: ROLE_SCREENS[key].blurb,
  }));

export function isScreenKey(value: unknown): value is ScreenKey {
  return typeof value === "string" && value in ROLE_SCREENS;
}

export function getScreen(key: string | null | undefined): ScreenTemplate | null {
  if (!key || !isScreenKey(key)) return null;
  return ROLE_SCREENS[key];
}

export function getScreenLabel(key: string | null | undefined): string {
  const screen = getScreen(key);
  return screen ? screen.shortLabel : "";
}

/**
 * Suggests the best-fit screen for a job title. Used to default the screen
 * picker when a recruiter types a title or applies a template.
 */
export function suggestScreenForTitle(title: string): ScreenKey | null {
  const t = title.toLowerCase();
  if (/supervisor|manager|lead|superintendent|reliability manager|maintenance manager/.test(t)) {
    return "maintenance_leader";
  }
  if (/controls|plc|automation|instrument|hmi|scada/.test(t)) return "controls_tech";
  if (/electric/.test(t)) return "industrial_electrician";
  if (/maintenance|mechanic|technician|millwright|repair/.test(t)) return "maintenance_tech";
  return null;
}

// ─── Public (answer-key-free) shape sent to applicants ──────────────────────
export type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  help?: string;
  options?: string[];
  items?: RankingItem[];
};

export type PublicScreen = {
  key: ScreenKey;
  label: string;
  blurb: string;
  questions: PublicQuestion[];
};

/**
 * Deterministic reordering so ranking items are never presented in the correct
 * order. Reversing is stable across renders and obviously not the answer key.
 */
function displayItems(items: RankingItem[]): RankingItem[] {
  return [...items].reverse();
}

/**
 * Strips every answer key (correctIndex, optionScores, rubric, idealPoints, and
 * the correct ranking order) before the screen is sent to the public browser.
 */
export function toPublicScreen(template: ScreenTemplate): PublicScreen {
  return {
    key: template.key,
    label: template.label,
    blurb: template.blurb,
    questions: template.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      help: q.help,
      options: q.options ? [...q.options] : undefined,
      items: q.items ? displayItems(q.items) : undefined,
    })),
  };
}
