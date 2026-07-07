/**
 * Job-description template library.
 *
 * Each template carries a browsable label + sample title alongside the salary
 * and description defaults. The job form uses these two ways: an explicit
 * "start from a template" picker, and implicit auto-fill when a typed title
 * matches a template's pattern. Extension point: an LLM could rewrite/expand a
 * chosen template behind ANTHROPIC_API_KEY; today the offline library is used.
 */

export type JdTemplate = {
  id: string;
  label: string;
  sampleTitle: string;
  pattern: RegExp;
  employment_type: string;
  salary_min: string;
  salary_max: string;
  salary_period: string;
  description: string;
};

export const JD_TEMPLATES: JdTemplate[] = [
  {
    id: "maintenance-supervisor",
    label: "Maintenance Supervisor / Manager",
    sampleTitle: "Maintenance Supervisor",
    pattern: /maintenance\s*(supervisor|manager)/i,
    employment_type: "FULL_TIME",
    salary_min: "85000",
    salary_max: "110000",
    salary_period: "YEAR",
    description:
      "Supervise and coordinate maintenance activities including preventive maintenance programs, equipment repairs, and facility upkeep. Manage maintenance staff scheduling, training, and performance. Ensure compliance with safety regulations and maintain documentation of all maintenance activities.\n\nRequirements:\n- 5+ years maintenance experience in industrial/manufacturing environment\n- Knowledge of PLCs, electrical systems, and mechanical systems\n- Experience with CMMS software\n- Strong leadership and communication skills\n- OSHA safety knowledge\n\nJob Type: Full-time",
  },
  {
    id: "maintenance-technician",
    label: "Maintenance Technician",
    sampleTitle: "Maintenance Technician",
    pattern: /maintenance\s*technician/i,
    employment_type: "FULL_TIME",
    salary_min: "55000",
    salary_max: "75000",
    salary_period: "YEAR",
    description:
      "Perform preventive and corrective maintenance on production equipment, HVAC systems, and facility infrastructure. Troubleshoot electrical, mechanical, pneumatic, and hydraulic systems. Complete work orders and maintain accurate maintenance records.\n\nRequirements:\n- 3+ years industrial maintenance experience\n- Knowledge of PLCs and electrical troubleshooting\n- Ability to read schematics, blueprints, and technical manuals\n- Experience with welding, fabrication, or machining preferred\n- Must be available for on-call rotation\n\nJob Type: Full-time",
  },
  {
    id: "electrician",
    label: "Industrial Electrician",
    sampleTitle: "Industrial Electrician",
    pattern: /electrician|electrical\s*technician/i,
    employment_type: "FULL_TIME",
    salary_min: "65000",
    salary_max: "90000",
    salary_period: "YEAR",
    description:
      "Install, maintain, and repair electrical systems including wiring, conduit, panels, motors, VFDs, and control systems. Perform troubleshooting using multimeters, meggars, and thermal imaging. Ensure all work meets NEC code requirements.\n\nRequirements:\n- Journeyman or Master Electrician license\n- Experience with 480V 3-phase systems\n- PLC programming knowledge (Allen-Bradley, Siemens)\n- Ability to read electrical drawings and schematics\n- NFPA 70E arc flash training\n\nJob Type: Full-time",
  },
  {
    id: "controls-engineer",
    label: "Controls / Automation Engineer",
    sampleTitle: "Controls Engineer",
    pattern: /plc\s*programmer|controls\s*engineer|automation\s*engineer/i,
    employment_type: "FULL_TIME",
    salary_min: "90000",
    salary_max: "130000",
    salary_period: "YEAR",
    description:
      "Design, program, and commission PLC-based control systems for manufacturing automation. Develop HMI interfaces, configure industrial networks, and integrate SCADA systems. Support production with troubleshooting and continuous improvement projects.\n\nRequirements:\n- BS in Electrical Engineering or related field\n- 3+ years PLC programming (Allen-Bradley, Siemens, or Mitsubishi)\n- Experience with HMI development (FactoryTalk, WinCC)\n- Knowledge of industrial communication protocols (EtherNet/IP, Profinet, Modbus)\n- AutoCAD Electrical proficiency\n\nJob Type: Full-time",
  },
  {
    id: "machine-operator",
    label: "Machine / Production Operator",
    sampleTitle: "Machine Operator",
    pattern: /machine\s*operator|production\s*operator/i,
    employment_type: "FULL_TIME",
    salary_min: "38000",
    salary_max: "52000",
    salary_period: "YEAR",
    description:
      "Operate and monitor production machinery to meet quality and output targets. Perform basic machine setup, changeovers, and minor adjustments. Conduct quality checks and maintain production logs.\n\nRequirements:\n- High school diploma or GED\n- 1+ years manufacturing experience preferred\n- Ability to read and follow work instructions\n- Basic math and measurement skills\n- Ability to lift 50 lbs and stand for extended periods\n\nJob Type: Full-time",
  },
  {
    id: "warehouse",
    label: "Warehouse / Material Handler",
    sampleTitle: "Warehouse Associate",
    pattern: /warehouse|material\s*handler|forklift/i,
    employment_type: "FULL_TIME",
    salary_min: "35000",
    salary_max: "48000",
    salary_period: "YEAR",
    description:
      "Receive, store, and distribute materials, equipment, and products within the warehouse. Operate forklifts and other material handling equipment. Maintain inventory accuracy and ensure proper storage conditions.\n\nRequirements:\n- Valid forklift certification\n- Experience with warehouse management systems (WMS)\n- Ability to lift 50+ lbs regularly\n- Basic computer skills for inventory tracking\n- Attention to detail for accurate order picking\n\nJob Type: Full-time",
  },
  {
    id: "welder",
    label: "Welder / Fabricator",
    sampleTitle: "Welder",
    pattern: /welder|welding/i,
    employment_type: "FULL_TIME",
    salary_min: "50000",
    salary_max: "72000",
    salary_period: "YEAR",
    description:
      "Perform MIG, TIG, and stick welding on various metals including carbon steel, stainless steel, and aluminum. Read and interpret blueprints, welding symbols, and fabrication drawings. Ensure all welds meet quality standards and pass inspection.\n\nRequirements:\n- AWS certification preferred\n- 3+ years welding experience in industrial setting\n- Proficiency in multiple welding processes\n- Ability to read blueprints and welding symbols\n- Knowledge of metallurgy and heat treatment basics\n\nJob Type: Full-time",
  },
  {
    id: "hvac",
    label: "HVAC / Refrigeration Technician",
    sampleTitle: "HVAC Technician",
    pattern: /hvac|refrigeration/i,
    employment_type: "FULL_TIME",
    salary_min: "55000",
    salary_max: "80000",
    salary_period: "YEAR",
    description:
      "Install, maintain, and repair HVAC and refrigeration systems in commercial and industrial facilities. Perform preventive maintenance, diagnose system failures, and ensure optimal performance. Handle refrigerant recovery and charging per EPA regulations.\n\nRequirements:\n- EPA 608 Universal Certification\n- 3+ years commercial/industrial HVAC experience\n- Knowledge of building automation systems (BAS)\n- Ability to read mechanical drawings and wiring diagrams\n- Valid driver's license\n\nJob Type: Full-time",
  },
  {
    id: "project-manager",
    label: "Project Manager",
    sampleTitle: "Project Manager",
    pattern: /project\s*manager/i,
    employment_type: "FULL_TIME",
    salary_min: "95000",
    salary_max: "130000",
    salary_period: "YEAR",
    description:
      "Lead and manage capital projects from conception through commissioning. Develop project scopes, budgets, and schedules. Coordinate with engineering, operations, and contractors to ensure on-time, on-budget delivery.\n\nRequirements:\n- PMP certification preferred\n- 5+ years project management experience in industrial/manufacturing\n- Proficiency in MS Project or Primavera\n- Strong budget management and vendor negotiation skills\n- Bachelor's degree in Engineering or related field\n\nJob Type: Full-time",
  },
  {
    id: "safety-manager",
    label: "Safety Manager / Coordinator",
    sampleTitle: "Safety Manager",
    pattern: /safety\s*(manager|coordinator|specialist)/i,
    employment_type: "FULL_TIME",
    salary_min: "70000",
    salary_max: "95000",
    salary_period: "YEAR",
    description:
      "Develop and implement safety programs to ensure compliance with OSHA regulations and company policies. Conduct safety audits, incident investigations, and risk assessments. Lead safety training programs and maintain safety documentation.\n\nRequirements:\n- CSP or ASP certification preferred\n- 3+ years safety management in manufacturing/industrial\n- Knowledge of OSHA 29 CFR 1910 (General Industry)\n- Experience with LOTO, confined space, fall protection programs\n- Strong communication and training delivery skills\n\nJob Type: Full-time",
  },
  {
    id: "quality-engineer",
    label: "Quality Engineer / Inspector",
    sampleTitle: "Quality Engineer",
    pattern: /quality\s*(engineer|inspector|manager)/i,
    employment_type: "FULL_TIME",
    salary_min: "70000",
    salary_max: "100000",
    salary_period: "YEAR",
    description:
      "Develop and maintain quality management systems. Perform inspections, audits, and root cause analysis. Drive continuous improvement initiatives using statistical methods and lean principles.\n\nRequirements:\n- CQE or Six Sigma certification preferred\n- Experience with ISO 9001 / IATF 16949\n- Proficiency in SPC, FMEA, and 8D methodology\n- Knowledge of GD&T and CMM operation\n- Strong analytical and problem-solving skills\n\nJob Type: Full-time",
  },
];

/** Returns the first template whose pattern matches the given title, or null. */
export function matchTemplateByTitle(title: string): JdTemplate | null {
  if (!title || title.length < 3) return null;
  for (const template of JD_TEMPLATES) {
    if (template.pattern.test(title)) return template;
  }
  return null;
}

export function getTemplateById(id: string): JdTemplate | null {
  return JD_TEMPLATES.find((template) => template.id === id) ?? null;
}
