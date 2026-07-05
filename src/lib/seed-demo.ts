import { createApplication } from "./applications";
import { assessRisk, deriveRecommendedAction, type ScreenSummary } from "./candidate-intel";
import { getDb } from "./db";
import { createJob } from "./jobs";
import { scoreResumeHeuristic } from "./scoring";
import { scoreScreenOffline, type ScreenAnswers } from "./screen-scoring";
import { saveScreenSubmission } from "./screen-submissions";
import { extractSkills } from "./skills";

/**
 * Seeds a sales-demo dataset that proves the thesis: a generic ATS ranks the
 * keyword-stuffed resume at the top, while EAS Recruit ranks the real
 * troubleshooter higher because of the skills screen. Deterministic — screens
 * are graded offline so the ordering is identical on every machine.
 */

const ELEC_REF = "DEMO-ELEC-001";
const CONTROLS_REF = "DEMO-CTRL-001";

const ELEC_DESCRIPTION = `2nd-shift Industrial Electrician for a food-manufacturing plant. You'll troubleshoot 480V three-phase motor controls, VFDs, and control panels, keep packaging and refrigeration lines running, and support PLC-driven equipment.

Requirements: strong electrical troubleshooting, motor controls, VFD experience, control panel wiring, and a real commitment to electrical safety (LOTO, NFPA 70E). Allen-Bradley experience a plus.`;

const CONTROLS_DESCRIPTION = `Controls / PLC Technician for a high-speed packaging operation. You'll troubleshoot PLCs, HMIs, VFDs, and sensors on production equipment, work with ladder logic online, and drive down downtime.

Requirements: hands-on PLC and HMI troubleshooting, VFD experience, ladder logic, and the ability to go online and find the problem fast. Allen-Bradley and Siemens experience a plus.`;

// Ranking answers for the electrician LOTO question.
const LOTO_CORRECT = ["notify", "shutdown", "isolate", "lock", "release", "verify"];
const LOTO_ALMOST = ["notify", "shutdown", "isolate", "lock", "verify", "release"];
const LOTO_REVERSED = ["verify", "release", "lock", "isolate", "shutdown", "notify"];

type SeedCandidate = {
  job: "elec" | "controls";
  name: string;
  email: string;
  phone: string;
  location: string;
  desiredPay: string;
  resumeText: string;
  answers: ScreenAnswers;
  note: string;
};

const CANDIDATES: SeedCandidate[] = [
  // ── Electrician: strong troubleshooter, weak resume ──────────────────────
  {
    job: "elec",
    name: "Ray Delgado",
    email: "ray.delgado@example.com",
    phone: "559-555-0142",
    location: "Fresno, CA",
    desiredPay: "$34/hr",
    resumeText:
      "Ten years fixing machines at a food plant on second shift. Good with motors, drives, and control panels. Show up every day, keep the lines running.",
    note: "Strong real-world troubleshooter with a thin resume.",
    answers: {
      ie_vfd_oc:
        "First I'd megger the motor and the leads to check for a shorted or grounded winding, then turn the shaft to make sure nothing is bound up or the rotor isn't locked. If that checks out I'd look at the accel/ramp time being set too fast and the drive's current limit parameter, and check for any loose connections at the terminals.",
      ie_overload_purpose: 0,
      ie_24vdc_no_output:
        "I'd meter the 24V supply first to confirm it's there and the fuse is good, then trace the circuit with my meter from the input switch through the terminals and field wiring out to the coil to find exactly where I lose voltage.",
      ie_contactor_no_motor: 1,
      ie_panel_safety:
        "De-energize and lock it out if I can, then verify zero energy with my meter — test before touch. If it has to be worked live I wear arc-flash rated PPE, use insulated tools, and follow NFPA 70E.",
      ie_loto_order: LOTO_CORRECT,
      ie_experience: 3,
    },
  },
  // ── Electrician: keyword-stuffed, fails the screen ───────────────────────
  {
    job: "elec",
    name: "Trevor Blake",
    email: "trevor.blake@example.com",
    phone: "312-555-0175",
    location: "Fresno, CA",
    desiredPay: "$33/hr",
    resumeText:
      "Industrial Electrician. Expert in VFD, PLC, SCADA, HMI, Allen-Bradley, Siemens, motor controls, ladder logic, instrumentation, hydraulics, pneumatics, AutoCAD Electrical, variable frequency drive, overload, troubleshooting, wiring, panel building, control systems, robotics.",
    note: "Resume is stuffed with every keyword; can't actually troubleshoot.",
    answers: {
      ie_vfd_oc: "Reset the drive and clear the overcurrent fault, then check the fault code.",
      ie_overload_purpose: 1,
      ie_24vdc_no_output: "Swap the PLC card and reboot the system.",
      ie_contactor_no_motor: 2,
      ie_panel_safety: "Just work fast and don't touch the hot wires.",
      ie_loto_order: LOTO_REVERSED,
      ie_experience: 1,
    },
  },
  // ── Electrician: average ─────────────────────────────────────────────────
  {
    job: "elec",
    name: "Marcus Hill",
    email: "marcus.hill@example.com",
    phone: "209-555-0188",
    location: "Modesto, CA",
    desiredPay: "$30/hr",
    resumeText:
      "Maintenance electrician with 4 years in a bottling plant. Motor controls, some VFD work, panel wiring, and preventive maintenance.",
    note: "Solid but not exceptional — worth a phone screen.",
    answers: {
      ie_vfd_oc:
        "I'd check the motor for a short and make sure nothing is binding mechanically, then look at the drive settings and parameters.",
      ie_overload_purpose: 0,
      ie_24vdc_no_output:
        "I'd check the 24 volt supply and the fuse, then check the wiring and the switch feeding the device.",
      ie_contactor_no_motor: 2,
      ie_panel_safety: "Lock it out and confirm it's dead before working, and wear the right PPE.",
      ie_loto_order: LOTO_ALMOST,
      ie_experience: 2,
    },
  },
  // ── Electrician: no-show / pay-mismatch / job-hop risk ───────────────────
  {
    job: "elec",
    name: "Danny Cruz",
    email: "danny.cruz@example.com",
    phone: "305-555-0119",
    location: "Miami, FL",
    desiredPay: "$135,000",
    resumeText:
      "Industrial electrician. 2022-2023 Acme Foods. 2021-2022 Beta Plastics. 2020-2021 Gamma Metals. 2019-2020 Delta Packaging. Skilled in motor controls, VFDs, and PLC troubleshooting.",
    note: "Pay far above the range, out of state, and a job-hop history.",
    answers: {
      ie_vfd_oc:
        "I'd check for a shorted motor and look at the ramp time, and check the connections.",
      ie_overload_purpose: 0,
      ie_24vdc_no_output: "Check the supply voltage and the wiring.",
      ie_contactor_no_motor: 1,
      ie_panel_safety: "Lock out and wear PPE.",
      ie_loto_order: LOTO_ALMOST,
      ie_experience: 2,
    },
  },
  // ── Controls: strong troubleshooter, weak resume ─────────────────────────
  {
    job: "controls",
    name: "Nina Alvarez",
    email: "nina.alvarez@example.com",
    phone: "616-555-0161",
    location: "Grand Rapids, MI",
    desiredPay: "$38/hr",
    resumeText:
      "Fifteen years on packaging lines keeping high-speed equipment running. Comfortable going online to find the problem and get production back up.",
    note: "Elite controls troubleshooter; resume undersells her.",
    answers: {
      ct_photoeye_stuck:
        "I'd check the sensor is aligned and the lens/reflector is clean and actually seeing a target, look for a shorted wire, then compare the input card LED to the status in the PLC and see if the point is forced. I'd also verify the light-on vs dark-on setting.",
      ct_hmi_no_output:
        "I'd go online and watch the output rung to see which condition is false — usually a permissive, interlock, or e-stop that isn't made, or it's in the wrong mode. If the logic shows it should be on, I'd check the physical output card, the field wiring, and the starter.",
      ct_io_types: 1,
      ct_vfd_run_no_start:
        "I'd check for an active fault that needs a reset, a missing enable or safety input, a zero speed reference, whether it's in Hand/Local instead of Auto/Remote, and the run-command wiring back to the drive.",
      ct_online:
        "It means being connected to the running PLC and watching the rungs and bits change in real time, so you can see which condition is true or false and find the permissive that's stopping the output.",
      ct_input_mismatch: 2,
      ct_experience: 3,
    },
  },
  // ── Controls: keyword-stuffed, fails the screen ──────────────────────────
  {
    job: "controls",
    name: "Kyle Fenton",
    email: "kyle.fenton@example.com",
    phone: "469-555-0133",
    location: "Grand Rapids, MI",
    desiredPay: "$37/hr",
    resumeText:
      "Controls Technician. PLC, HMI, SCADA, VFD, ladder logic, Allen-Bradley, Siemens, ControlLogix, RSLogix, motor controls, instrumentation, robotics, servo, SCADA, PLC, HMI, VFD expert.",
    note: "Every controls keyword on the resume; screen exposes him.",
    answers: {
      ct_photoeye_stuck: "Replace the sensor and reboot the PLC.",
      ct_hmi_no_output: "Restart the HMI and download the program again.",
      ct_io_types: 0,
      ct_vfd_run_no_start: "Check the VFD and reset it.",
      ct_online: "It means you are online.",
      ct_input_mismatch: 0,
      ct_experience: 1,
    },
  },
  // ── Controls: average ────────────────────────────────────────────────────
  {
    job: "controls",
    name: "Owen Pratt",
    email: "owen.pratt@example.com",
    phone: "231-555-0177",
    location: "Holland, MI",
    desiredPay: "$32/hr",
    resumeText:
      "Automation tech with 3 years on packaging equipment. PLC and HMI troubleshooting, sensor replacement, some VFD work.",
    note: "Real but developing — a reasonable phone screen.",
    answers: {
      ct_photoeye_stuck:
        "I'd check if the sensor is aligned and seeing the target, and look at the input card LED versus the PLC.",
      ct_hmi_no_output:
        "I'd go online and check the logic for a permissive or interlock that isn't made, then check the output wiring.",
      ct_io_types: 1,
      ct_vfd_run_no_start: "I'd check for a fault, the speed reference, and whether it's in remote.",
      ct_online: "Watching the PLC logic live while it runs to see the bits.",
      ct_input_mismatch: 2,
      ct_experience: 2,
    },
  },
  // ── Controls: supervisor-level applying to a tech role ───────────────────
  {
    job: "controls",
    name: "Gloria Meyer",
    email: "gloria.meyer@example.com",
    phone: "414-555-0155",
    location: "Grand Rapids, MI",
    desiredPay: "$40/hr",
    resumeText:
      "Maintenance Supervisor for 8 years; managed a team of 12 technicians and ran the PM program and CMMS. Strong controls background — PLC, HMI, and VFD troubleshooting — before moving into leadership.",
    note: "Overqualified: a supervisor applying to a hands-on tech role.",
    answers: {
      ct_photoeye_stuck:
        "Check the sensor alignment and lens, look for a shorted wire, then compare the input card LED to the PLC status and check for a force.",
      ct_hmi_no_output:
        "Go online and find the false condition — a permissive or interlock or the wrong mode — then verify the output card and wiring.",
      ct_io_types: 1,
      ct_vfd_run_no_start:
        "Look for a fault to reset, a missing enable, the speed reference at zero, or Hand vs Remote.",
      ct_online: "Being connected to the running processor and watching the rungs live to find the problem.",
      ct_input_mismatch: 2,
      ct_experience: 3,
    },
  },
];

function nowMinusHours(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

/**
 * Returns true if the demo jobs already exist for this org (idempotency guard).
 */
export function demoDataExists(organizationId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM jobs WHERE organization_id = ? AND reference_number IN (?, ?) LIMIT 1")
    .get(organizationId, ELEC_REF, CONTROLS_REF);
  return Boolean(row);
}

export function seedDemoData(organizationId: string, companyName: string): { seeded: boolean; jobs: number; candidates: number } {
  if (demoDataExists(organizationId)) {
    return { seeded: false, jobs: 0, candidates: 0 };
  }

  const elecJob = createJob(organizationId, companyName, {
    title: "Industrial Electrician — 2nd Shift",
    description: ELEC_DESCRIPTION,
    location: "Fresno, CA",
    city: "Fresno",
    state: "CA",
    zip: "93721",
    employment_type: "FULL_TIME",
    salary_min: 62000,
    salary_max: 78000,
    salary_period: "YEAR",
    reference_number: ELEC_REF,
    screen_key: "industrial_electrician",
    status: "published",
  });

  const controlsJob = createJob(organizationId, companyName, {
    title: "Controls / PLC Technician",
    description: CONTROLS_DESCRIPTION,
    location: "Grand Rapids, MI",
    city: "Grand Rapids",
    state: "MI",
    zip: "49503",
    employment_type: "FULL_TIME",
    salary_min: 68000,
    salary_max: 85000,
    salary_period: "YEAR",
    reference_number: CONTROLS_REF,
    screen_key: "controls_tech",
    status: "published",
  });

  let count = 0;
  CANDIDATES.forEach((candidate, index) => {
    const job = candidate.job === "elec" ? elecJob : controlsJob;
    const result = scoreScreenOffline(job.screen_key, candidate.answers);
    const match = scoreResumeHeuristic({
      resumeText: candidate.resumeText,
      jobTitle: job.title,
      jobDescription: job.description,
    });
    const candidateIsLead = /supervisor|manager|superintendent|maintenance lead|reliability lead|team lead/i.test(
      candidate.resumeText,
    );
    const risk = assessRisk({
      job,
      desiredPay: candidate.desiredPay,
      applicantLocation: candidate.location,
      resumeText: candidate.resumeText,
      screenScore: result?.overallScore ?? null,
      jobIsLeadRole: job.screen_key === "maintenance_leader",
      candidateIsLead,
    });

    const summary: ScreenSummary = {
      strengths: result?.strengths ?? [],
      redFlags: result?.redFlags ?? [],
      recommendedAction: deriveRecommendedAction(result?.overallScore ?? null, "completed", risk.level),
      strongDims: result?.strongDims ?? [],
      weakDims: result?.weakDims ?? [],
      method: "heuristic",
    };

    const application = createApplication({
      organization_id: organizationId,
      job_id: job.id,
      applicant_name: candidate.name,
      applicant_email: candidate.email,
      applicant_phone: candidate.phone,
      cover_letter: "",
      resume_filename: `${candidate.name.toLowerCase().replace(/\s+/g, "-")}-resume.pdf`,
      resume_content_type: "application/pdf",
      resume_data: Buffer.from(candidate.resumeText, "utf8"),
      resume_text: candidate.resumeText,
      resume_skills: extractSkills(candidate.resumeText),
      match_score: match.score,
      applicant_location: candidate.location,
      desired_pay: candidate.desiredPay,
      screen_status: "completed",
      screen_score: result?.overallScore ?? null,
      risk_level: risk.level,
      risk_flags: risk.flags,
      screen_summary: summary,
      created_at: nowMinusHours(index + 1),
    });

    if (result) {
      saveScreenSubmission({
        organizationId,
        applicationId: application.id,
        jobId: job.id,
        screenKey: job.screen_key,
        answers: candidate.answers,
        result,
      });
    }
    count += 1;
  });

  return { seeded: true, jobs: 2, candidates: count };
}
