"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Job, JobStatus } from "@/lib/db";

type JobFormValues = {
  title: string;
  description: string;
  location: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  employment_type: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: string;
  company_name: string;
  reference_number: string;
  status: JobStatus;
};

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERN"];
const SALARY_PERIODS = ["YEAR", "HOUR", "MONTH"];

// ─── US Cities Database (major cities + industrial hubs) ───────────────────
type CityEntry = { city: string; state: string; stateCode: string; zip: string };

const US_CITIES: CityEntry[] = [
  // California
  { city: "Newark", state: "California", stateCode: "CA", zip: "94560" },
  { city: "Fremont", state: "California", stateCode: "CA", zip: "94536" },
  { city: "San Jose", state: "California", stateCode: "CA", zip: "95101" },
  { city: "Los Angeles", state: "California", stateCode: "CA", zip: "90001" },
  { city: "San Francisco", state: "California", stateCode: "CA", zip: "94102" },
  { city: "San Diego", state: "California", stateCode: "CA", zip: "92101" },
  { city: "Sacramento", state: "California", stateCode: "CA", zip: "95814" },
  { city: "Oakland", state: "California", stateCode: "CA", zip: "94601" },
  { city: "Hayward", state: "California", stateCode: "CA", zip: "94541" },
  { city: "Milpitas", state: "California", stateCode: "CA", zip: "95035" },
  { city: "Union City", state: "California", stateCode: "CA", zip: "94587" },
  { city: "Stockton", state: "California", stateCode: "CA", zip: "95202" },
  { city: "Fresno", state: "California", stateCode: "CA", zip: "93701" },
  { city: "Bakersfield", state: "California", stateCode: "CA", zip: "93301" },
  { city: "Modesto", state: "California", stateCode: "CA", zip: "95354" },
  { city: "Riverside", state: "California", stateCode: "CA", zip: "92501" },
  { city: "Anaheim", state: "California", stateCode: "CA", zip: "92801" },
  { city: "Santa Ana", state: "California", stateCode: "CA", zip: "92701" },
  { city: "Irvine", state: "California", stateCode: "CA", zip: "92602" },
  { city: "Long Beach", state: "California", stateCode: "CA", zip: "90801" },
  // Texas
  { city: "Houston", state: "Texas", stateCode: "TX", zip: "77001" },
  { city: "Dallas", state: "Texas", stateCode: "TX", zip: "75201" },
  { city: "Austin", state: "Texas", stateCode: "TX", zip: "78701" },
  { city: "San Antonio", state: "Texas", stateCode: "TX", zip: "78201" },
  { city: "Fort Worth", state: "Texas", stateCode: "TX", zip: "76101" },
  { city: "El Paso", state: "Texas", stateCode: "TX", zip: "79901" },
  { city: "Arlington", state: "Texas", stateCode: "TX", zip: "76010" },
  { city: "Plano", state: "Texas", stateCode: "TX", zip: "75023" },
  { city: "Corpus Christi", state: "Texas", stateCode: "TX", zip: "78401" },
  { city: "Lubbock", state: "Texas", stateCode: "TX", zip: "79401" },
  // Florida
  { city: "Miami", state: "Florida", stateCode: "FL", zip: "33101" },
  { city: "Orlando", state: "Florida", stateCode: "FL", zip: "32801" },
  { city: "Tampa", state: "Florida", stateCode: "FL", zip: "33601" },
  { city: "Jacksonville", state: "Florida", stateCode: "FL", zip: "32099" },
  { city: "St. Petersburg", state: "Florida", stateCode: "FL", zip: "33701" },
  // New York
  { city: "New York", state: "New York", stateCode: "NY", zip: "10001" },
  { city: "Buffalo", state: "New York", stateCode: "NY", zip: "14201" },
  { city: "Rochester", state: "New York", stateCode: "NY", zip: "14604" },
  { city: "Albany", state: "New York", stateCode: "NY", zip: "12207" },
  // Illinois
  { city: "Chicago", state: "Illinois", stateCode: "IL", zip: "60601" },
  { city: "Aurora", state: "Illinois", stateCode: "IL", zip: "60502" },
  { city: "Rockford", state: "Illinois", stateCode: "IL", zip: "61101" },
  // Pennsylvania
  { city: "Philadelphia", state: "Pennsylvania", stateCode: "PA", zip: "19101" },
  { city: "Pittsburgh", state: "Pennsylvania", stateCode: "PA", zip: "15201" },
  // Ohio
  { city: "Columbus", state: "Ohio", stateCode: "OH", zip: "43215" },
  { city: "Cleveland", state: "Ohio", stateCode: "OH", zip: "44101" },
  { city: "Cincinnati", state: "Ohio", stateCode: "OH", zip: "45201" },
  // Georgia
  { city: "Atlanta", state: "Georgia", stateCode: "GA", zip: "30301" },
  { city: "Savannah", state: "Georgia", stateCode: "GA", zip: "31401" },
  // North Carolina
  { city: "Charlotte", state: "North Carolina", stateCode: "NC", zip: "28201" },
  { city: "Raleigh", state: "North Carolina", stateCode: "NC", zip: "27601" },
  // Michigan
  { city: "Detroit", state: "Michigan", stateCode: "MI", zip: "48201" },
  { city: "Grand Rapids", state: "Michigan", stateCode: "MI", zip: "49501" },
  // Arizona
  { city: "Phoenix", state: "Arizona", stateCode: "AZ", zip: "85001" },
  { city: "Tucson", state: "Arizona", stateCode: "AZ", zip: "85701" },
  { city: "Mesa", state: "Arizona", stateCode: "AZ", zip: "85201" },
  // Washington
  { city: "Seattle", state: "Washington", stateCode: "WA", zip: "98101" },
  { city: "Tacoma", state: "Washington", stateCode: "WA", zip: "98401" },
  // Colorado
  { city: "Denver", state: "Colorado", stateCode: "CO", zip: "80201" },
  { city: "Colorado Springs", state: "Colorado", stateCode: "CO", zip: "80901" },
  // Tennessee
  { city: "Nashville", state: "Tennessee", stateCode: "TN", zip: "37201" },
  { city: "Memphis", state: "Tennessee", stateCode: "TN", zip: "38101" },
  // Indiana
  { city: "Indianapolis", state: "Indiana", stateCode: "IN", zip: "46201" },
  // Missouri
  { city: "Kansas City", state: "Missouri", stateCode: "MO", zip: "64101" },
  { city: "St. Louis", state: "Missouri", stateCode: "MO", zip: "63101" },
  // Nevada
  { city: "Las Vegas", state: "Nevada", stateCode: "NV", zip: "89101" },
  // Oregon
  { city: "Portland", state: "Oregon", stateCode: "OR", zip: "97201" },
  // Wisconsin
  { city: "Milwaukee", state: "Wisconsin", stateCode: "WI", zip: "53201" },
  // Minnesota
  { city: "Minneapolis", state: "Minnesota", stateCode: "MN", zip: "55401" },
  // Louisiana
  { city: "New Orleans", state: "Louisiana", stateCode: "LA", zip: "70112" },
  // Alabama
  { city: "Birmingham", state: "Alabama", stateCode: "AL", zip: "35201" },
  // South Carolina
  { city: "Charleston", state: "South Carolina", stateCode: "SC", zip: "29401" },
  // Oklahoma
  { city: "Oklahoma City", state: "Oklahoma", stateCode: "OK", zip: "73101" },
  // Virginia
  { city: "Virginia Beach", state: "Virginia", stateCode: "VA", zip: "23450" },
  { city: "Richmond", state: "Virginia", stateCode: "VA", zip: "23219" },
  // Maryland
  { city: "Baltimore", state: "Maryland", stateCode: "MD", zip: "21201" },
  // Massachusetts
  { city: "Boston", state: "Massachusetts", stateCode: "MA", zip: "02101" },
  // New Jersey
  { city: "Newark", state: "New Jersey", stateCode: "NJ", zip: "07101" },
  { city: "Jersey City", state: "New Jersey", stateCode: "NJ", zip: "07302" },
  // Utah
  { city: "Salt Lake City", state: "Utah", stateCode: "UT", zip: "84101" },
  // Kentucky
  { city: "Louisville", state: "Kentucky", stateCode: "KY", zip: "40201" },
  // Iowa
  { city: "Des Moines", state: "Iowa", stateCode: "IA", zip: "50301" },
  // Kansas
  { city: "Wichita", state: "Kansas", stateCode: "KS", zip: "67201" },
  // Nebraska
  { city: "Omaha", state: "Nebraska", stateCode: "NE", zip: "68101" },
  // New Mexico
  { city: "Albuquerque", state: "New Mexico", stateCode: "NM", zip: "87101" },
  // Connecticut
  { city: "Hartford", state: "Connecticut", stateCode: "CT", zip: "06101" },
];

// ─── Job Title Intelligence ────────────────────────────────────────────────
type JobTitleSuggestion = {
  employment_type: string;
  salary_min: string;
  salary_max: string;
  salary_period: string;
  descriptionHint: string;
};

const JOB_TITLE_PATTERNS: { pattern: RegExp; suggestion: JobTitleSuggestion }[] = [
  {
    pattern: /maintenance\s*(supervisor|manager)/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "85000",
      salary_max: "110000",
      salary_period: "YEAR",
      descriptionHint: "Supervise and coordinate maintenance activities including preventive maintenance programs, equipment repairs, and facility upkeep. Manage maintenance staff scheduling, training, and performance. Ensure compliance with safety regulations and maintain documentation of all maintenance activities.\n\nRequirements:\n- 5+ years maintenance experience in industrial/manufacturing environment\n- Knowledge of PLCs, electrical systems, and mechanical systems\n- Experience with CMMS software\n- Strong leadership and communication skills\n- OSHA safety knowledge\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /maintenance\s*technician/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "55000",
      salary_max: "75000",
      salary_period: "YEAR",
      descriptionHint: "Perform preventive and corrective maintenance on production equipment, HVAC systems, and facility infrastructure. Troubleshoot electrical, mechanical, pneumatic, and hydraulic systems. Complete work orders and maintain accurate maintenance records.\n\nRequirements:\n- 3+ years industrial maintenance experience\n- Knowledge of PLCs and electrical troubleshooting\n- Ability to read schematics, blueprints, and technical manuals\n- Experience with welding, fabrication, or machining preferred\n- Must be available for on-call rotation\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /electrician|electrical\s*technician/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "65000",
      salary_max: "90000",
      salary_period: "YEAR",
      descriptionHint: "Install, maintain, and repair electrical systems including wiring, conduit, panels, motors, VFDs, and control systems. Perform troubleshooting using multimeters, meggars, and thermal imaging. Ensure all work meets NEC code requirements.\n\nRequirements:\n- Journeyman or Master Electrician license\n- Experience with 480V 3-phase systems\n- PLC programming knowledge (Allen-Bradley, Siemens)\n- Ability to read electrical drawings and schematics\n- NFPA 70E arc flash training\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /plc\s*programmer|controls\s*engineer|automation\s*engineer/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "90000",
      salary_max: "130000",
      salary_period: "YEAR",
      descriptionHint: "Design, program, and commission PLC-based control systems for manufacturing automation. Develop HMI interfaces, configure industrial networks, and integrate SCADA systems. Support production with troubleshooting and continuous improvement projects.\n\nRequirements:\n- BS in Electrical Engineering or related field\n- 3+ years PLC programming (Allen-Bradley, Siemens, or Mitsubishi)\n- Experience with HMI development (FactoryTalk, WinCC)\n- Knowledge of industrial communication protocols (EtherNet/IP, Profinet, Modbus)\n- AutoCAD Electrical proficiency\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /machine\s*operator|production\s*operator/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "38000",
      salary_max: "52000",
      salary_period: "YEAR",
      descriptionHint: "Operate and monitor production machinery to meet quality and output targets. Perform basic machine setup, changeovers, and minor adjustments. Conduct quality checks and maintain production logs.\n\nRequirements:\n- High school diploma or GED\n- 1+ years manufacturing experience preferred\n- Ability to read and follow work instructions\n- Basic math and measurement skills\n- Ability to lift 50 lbs and stand for extended periods\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /warehouse|material\s*handler|forklift/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "35000",
      salary_max: "48000",
      salary_period: "YEAR",
      descriptionHint: "Receive, store, and distribute materials, equipment, and products within the warehouse. Operate forklifts and other material handling equipment. Maintain inventory accuracy and ensure proper storage conditions.\n\nRequirements:\n- Valid forklift certification\n- Experience with warehouse management systems (WMS)\n- Ability to lift 50+ lbs regularly\n- Basic computer skills for inventory tracking\n- Attention to detail for accurate order picking\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /welder|welding/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "50000",
      salary_max: "72000",
      salary_period: "YEAR",
      descriptionHint: "Perform MIG, TIG, and stick welding on various metals including carbon steel, stainless steel, and aluminum. Read and interpret blueprints, welding symbols, and fabrication drawings. Ensure all welds meet quality standards and pass inspection.\n\nRequirements:\n- AWS certification preferred\n- 3+ years welding experience in industrial setting\n- Proficiency in multiple welding processes\n- Ability to read blueprints and welding symbols\n- Knowledge of metallurgy and heat treatment basics\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /hvac|refrigeration/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "55000",
      salary_max: "80000",
      salary_period: "YEAR",
      descriptionHint: "Install, maintain, and repair HVAC and refrigeration systems in commercial and industrial facilities. Perform preventive maintenance, diagnose system failures, and ensure optimal performance. Handle refrigerant recovery and charging per EPA regulations.\n\nRequirements:\n- EPA 608 Universal Certification\n- 3+ years commercial/industrial HVAC experience\n- Knowledge of building automation systems (BAS)\n- Ability to read mechanical drawings and wiring diagrams\n- Valid driver's license\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /project\s*manager/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "95000",
      salary_max: "130000",
      salary_period: "YEAR",
      descriptionHint: "Lead and manage capital projects from conception through commissioning. Develop project scopes, budgets, and schedules. Coordinate with engineering, operations, and contractors to ensure on-time, on-budget delivery.\n\nRequirements:\n- PMP certification preferred\n- 5+ years project management experience in industrial/manufacturing\n- Proficiency in MS Project or Primavera\n- Strong budget management and vendor negotiation skills\n- Bachelor's degree in Engineering or related field\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /safety\s*(manager|coordinator|specialist)/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "70000",
      salary_max: "95000",
      salary_period: "YEAR",
      descriptionHint: "Develop and implement safety programs to ensure compliance with OSHA regulations and company policies. Conduct safety audits, incident investigations, and risk assessments. Lead safety training programs and maintain safety documentation.\n\nRequirements:\n- CSP or ASP certification preferred\n- 3+ years safety management in manufacturing/industrial\n- Knowledge of OSHA 29 CFR 1910 (General Industry)\n- Experience with LOTO, confined space, fall protection programs\n- Strong communication and training delivery skills\n\nJob Type: Full-time",
    },
  },
  {
    pattern: /quality\s*(engineer|inspector|manager)/i,
    suggestion: {
      employment_type: "FULL_TIME",
      salary_min: "70000",
      salary_max: "100000",
      salary_period: "YEAR",
      descriptionHint: "Develop and maintain quality management systems. Perform inspections, audits, and root cause analysis. Drive continuous improvement initiatives using statistical methods and lean principles.\n\nRequirements:\n- CQE or Six Sigma certification preferred\n- Experience with ISO 9001 / IATF 16949\n- Proficiency in SPC, FMEA, and 8D methodology\n- Knowledge of GD&T and CMM operation\n- Strong analytical and problem-solving skills\n\nJob Type: Full-time",
    },
  },
];

function getJobTitleSuggestion(title: string): JobTitleSuggestion | null {
  if (!title || title.length < 3) return null;
  for (const { pattern, suggestion } of JOB_TITLE_PATTERNS) {
    if (pattern.test(title)) return suggestion;
  }
  return null;
}

// ─── Location Search ───────────────────────────────────────────────────────
function searchCities(query: string): CityEntry[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return US_CITIES.filter(
    (entry) =>
      entry.city.toLowerCase().startsWith(lower) ||
      entry.city.toLowerCase().includes(lower)
  ).slice(0, 8);
}

// ─── Main Component ────────────────────────────────────────────────────────
function jobToValues(job?: Job, defaultCompanyName?: string): JobFormValues {
  return {
    title: job?.title ?? "",
    description: job?.description ?? "",
    location: job?.location ?? "",
    city: job?.city ?? "",
    state: job?.state ?? "",
    country: job?.country ?? "US",
    zip: job?.zip ?? "",
    employment_type: job?.employment_type ?? "FULL_TIME",
    salary_min: job?.salary_min?.toString() ?? "",
    salary_max: job?.salary_max?.toString() ?? "",
    salary_currency: job?.salary_currency ?? "USD",
    salary_period: job?.salary_period ?? "YEAR",
    company_name: job?.company_name ?? defaultCompanyName ?? "",
    reference_number: job?.reference_number ?? "",
    status: job?.status ?? "draft",
  };
}

export function JobForm({
  orgSlug,
  job,
  defaultCompanyName,
}: {
  orgSlug: string;
  job?: Job;
  defaultCompanyName?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<JobFormValues>(() => jobToValues(job, defaultCompanyName));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Location autocomplete state
  const [citySuggestions, setCitySuggestions] = useState<CityEntry[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Job title suggestion state
  const [titleSuggestion, setTitleSuggestion] = useState<JobTitleSuggestion | null>(null);
  const [showTitleHint, setShowTitleHint] = useState(false);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        cityInputRef.current &&
        !cityInputRef.current.contains(event.target as Node)
      ) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateField<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  // Handle location label changes — auto-populate city/state
  const handleLocationChange = useCallback(
    (value: string) => {
      updateField("location", value);

      // Try to parse "City, ST" pattern from location label
      const match = value.match(/^([^,]+),\s*([A-Z]{2})\s*$/i);
      if (match) {
        const cityName = match[1].trim();
        const stateCode = match[2].toUpperCase();
        const found = US_CITIES.find(
          (c) => c.city.toLowerCase() === cityName.toLowerCase() && c.stateCode === stateCode
        );
        if (found) {
          setValues((current) => ({
            ...current,
            location: value,
            city: found.city,
            state: found.stateCode,
            zip: found.zip,
          }));
        } else {
          setValues((current) => ({
            ...current,
            location: value,
            city: cityName,
            state: stateCode,
          }));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handle city input with autocomplete
  const handleCityInput = useCallback((value: string) => {
    updateField("city", value);
    const results = searchCities(value);
    setCitySuggestions(results);
    setShowCitySuggestions(results.length > 0);
    setActiveSuggestionIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCity = useCallback((entry: CityEntry) => {
    setValues((current) => ({
      ...current,
      city: entry.city,
      state: entry.stateCode,
      zip: entry.zip,
      location: `${entry.city}, ${entry.stateCode}`,
    }));
    setShowCitySuggestions(false);
    setCitySuggestions([]);
  }, []);

  const handleCityKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!showCitySuggestions || citySuggestions.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < citySuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : citySuggestions.length - 1
        );
      } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        selectCity(citySuggestions[activeSuggestionIndex]);
      } else if (event.key === "Escape") {
        setShowCitySuggestions(false);
      }
    },
    [showCitySuggestions, citySuggestions, activeSuggestionIndex, selectCity]
  );

  // Handle job title changes — suggest employment type and salary
  const handleTitleChange = useCallback((value: string) => {
    updateField("title", value);
    const suggestion = getJobTitleSuggestion(value);
    setTitleSuggestion(suggestion);
    if (suggestion) {
      setShowTitleHint(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTitleSuggestion = useCallback(() => {
    if (!titleSuggestion) return;
    setValues((current) => ({
      ...current,
      employment_type: titleSuggestion.employment_type,
      salary_min: current.salary_min || titleSuggestion.salary_min,
      salary_max: current.salary_max || titleSuggestion.salary_max,
      salary_period: titleSuggestion.salary_period,
      description: current.description || titleSuggestion.descriptionHint,
    }));
    setShowTitleHint(false);
  }, [titleSuggestion]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const url = job ? `/api/o/${orgSlug}/jobs/${job.id}` : `/api/o/${orgSlug}/jobs`;
    const method = job ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Failed to save job");
      return;
    }

    router.push(`/o/${orgSlug}/admin`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Title with Intelligence */}
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Job title *</span>
          <input
            value={values.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            className="field-input"
            placeholder="e.g. Maintenance Supervisor, Electrician, PLC Programmer"
            required
          />
        </label>

        {showTitleHint && titleSuggestion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Auto-fill available:</span> We can pre-populate employment type, salary range, and a description template for this role.
              </p>
              <div className="ml-3 flex gap-2">
                <button
                  type="button"
                  onClick={applyTitleSuggestion}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setShowTitleHint(false)}
                  className="rounded bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-blue-600">
              Suggested: {titleSuggestion.employment_type.replace("_", " ")} · ${Number(titleSuggestion.salary_min).toLocaleString()}–${Number(titleSuggestion.salary_max).toLocaleString()}/{titleSuggestion.salary_period.toLowerCase()}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <label className="block space-y-1">
        <span className="text-sm font-medium">Description *</span>
        <textarea
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="field-input min-h-48"
          placeholder="Job responsibilities, requirements, and qualifications..."
          required
        />
      </label>

      {/* Location Section */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <legend className="px-2 text-sm font-semibold text-zinc-700">Location</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Location label *</span>
            <input
              value={values.location}
              onChange={(event) => handleLocationChange(event.target.value)}
              placeholder="Newark, CA"
              className="field-input"
              required
            />
            <span className="text-xs text-zinc-500">Displayed on job boards (e.g. &quot;Newark, CA&quot; or &quot;Remote&quot;)</span>
          </label>

          <div className="relative block space-y-1">
            <span className="text-sm font-medium">City</span>
            <input
              ref={cityInputRef}
              value={values.city}
              onChange={(event) => handleCityInput(event.target.value)}
              onFocus={() => {
                if (citySuggestions.length > 0) setShowCitySuggestions(true);
              }}
              onKeyDown={handleCityKeyDown}
              placeholder="Start typing a city name..."
              className="field-input"
              autoComplete="off"
            />
            <span className="text-xs text-zinc-500">Type a city to auto-fill State and ZIP</span>

            {showCitySuggestions && citySuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-[4.5rem] z-50 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
              >
                {citySuggestions.map((entry, index) => (
                  <button
                    key={`${entry.city}-${entry.stateCode}`}
                    type="button"
                    onClick={() => selectCity(entry)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                      index === activeSuggestionIndex ? "bg-blue-100" : ""
                    }`}
                  >
                    <span className="font-medium">{entry.city}</span>
                    <span className="text-zinc-500">, {entry.stateCode}</span>
                    <span className="ml-2 text-xs text-zinc-400">{entry.zip}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">State</span>
            <input
              value={values.state}
              onChange={(event) => updateField("state", event.target.value)}
              placeholder="Auto-filled from city"
              className="field-input bg-zinc-50"
              readOnly={false}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">ZIP</span>
            <input
              value={values.zip}
              onChange={(event) => updateField("zip", event.target.value)}
              placeholder="Auto-filled from city"
              className="field-input bg-zinc-50"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Country</span>
            <input
              value={values.country}
              onChange={(event) => updateField("country", event.target.value)}
              className="field-input"
            />
          </label>
        </div>
      </fieldset>

      {/* Employment & Compensation */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <legend className="px-2 text-sm font-semibold text-zinc-700">Employment &amp; Compensation</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Employment type</span>
            <select
              value={values.employment_type}
              onChange={(event) => updateField("employment_type", event.target.value)}
              className="field-input"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Salary period</span>
            <select
              value={values.salary_period}
              onChange={(event) => updateField("salary_period", event.target.value)}
              className="field-input"
            >
              {SALARY_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Salary min</span>
            <input
              type="number"
              value={values.salary_min}
              onChange={(event) => updateField("salary_min", event.target.value)}
              placeholder="e.g. 85000"
              className="field-input"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Salary max</span>
            <input
              type="number"
              value={values.salary_max}
              onChange={(event) => updateField("salary_max", event.target.value)}
              placeholder="e.g. 110000"
              className="field-input"
            />
          </label>
        </div>
      </fieldset>

      {/* Posting Details */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <legend className="px-2 text-sm font-semibold text-zinc-700">Posting Details</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Company name on posting</span>
            <input
              value={values.company_name}
              onChange={(event) => updateField("company_name", event.target.value)}
              className="field-input"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Reference number</span>
            <input
              value={values.reference_number}
              onChange={(event) => updateField("reference_number", event.target.value)}
              placeholder="Auto-generated if blank"
              className="field-input"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Status</span>
            <select
              value={values.status}
              onChange={(event) => updateField("status", event.target.value as JobStatus)}
              className="field-input"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : job ? "Update job" : "Create job"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/o/${orgSlug}/admin`)}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
