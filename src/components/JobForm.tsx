"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Job, JobStatus } from "@/lib/db";
import { JD_TEMPLATES, getTemplateById, matchTemplateByTitle, type JdTemplate } from "@/lib/jd-templates";

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
  // Additional major cities across all states (quick-pick suggestions)
  { city: "Seattle", state: "Washington", stateCode: "WA", zip: "98101" },
  { city: "Tacoma", state: "Washington", stateCode: "WA", zip: "98402" },
  { city: "Spokane", state: "Washington", stateCode: "WA", zip: "99201" },
  { city: "Portland", state: "Oregon", stateCode: "OR", zip: "97201" },
  { city: "Salem", state: "Oregon", stateCode: "OR", zip: "97301" },
  { city: "Eugene", state: "Oregon", stateCode: "OR", zip: "97401" },
  { city: "Denver", state: "Colorado", stateCode: "CO", zip: "80202" },
  { city: "Colorado Springs", state: "Colorado", stateCode: "CO", zip: "80903" },
  { city: "Aurora", state: "Colorado", stateCode: "CO", zip: "80010" },
  { city: "Phoenix", state: "Arizona", stateCode: "AZ", zip: "85004" },
  { city: "Tucson", state: "Arizona", stateCode: "AZ", zip: "85701" },
  { city: "Mesa", state: "Arizona", stateCode: "AZ", zip: "85201" },
  { city: "Las Vegas", state: "Nevada", stateCode: "NV", zip: "89101" },
  { city: "Reno", state: "Nevada", stateCode: "NV", zip: "89501" },
  { city: "Henderson", state: "Nevada", stateCode: "NV", zip: "89002" },
  { city: "Salt Lake City", state: "Utah", stateCode: "UT", zip: "84101" },
  { city: "Boise", state: "Idaho", stateCode: "ID", zip: "83702" },
  { city: "Houston", state: "Texas", stateCode: "TX", zip: "77002" },
  { city: "Dallas", state: "Texas", stateCode: "TX", zip: "75201" },
  { city: "Austin", state: "Texas", stateCode: "TX", zip: "78701" },
  { city: "San Antonio", state: "Texas", stateCode: "TX", zip: "78205" },
  { city: "Fort Worth", state: "Texas", stateCode: "TX", zip: "76102" },
  { city: "El Paso", state: "Texas", stateCode: "TX", zip: "79901" },
  { city: "Arlington", state: "Texas", stateCode: "TX", zip: "76010" },
  { city: "Chicago", state: "Illinois", stateCode: "IL", zip: "60601" },
  { city: "Aurora", state: "Illinois", stateCode: "IL", zip: "60505" },
  { city: "Detroit", state: "Michigan", stateCode: "MI", zip: "48226" },
  { city: "Grand Rapids", state: "Michigan", stateCode: "MI", zip: "49503" },
  { city: "Warren", state: "Michigan", stateCode: "MI", zip: "48088" },
  { city: "Minneapolis", state: "Minnesota", stateCode: "MN", zip: "55401" },
  { city: "St. Paul", state: "Minnesota", stateCode: "MN", zip: "55102" },
  { city: "Milwaukee", state: "Wisconsin", stateCode: "WI", zip: "53202" },
  { city: "Madison", state: "Wisconsin", stateCode: "WI", zip: "53703" },
  { city: "Indianapolis", state: "Indiana", stateCode: "IN", zip: "46204" },
  { city: "Fort Wayne", state: "Indiana", stateCode: "IN", zip: "46802" },
  { city: "Columbus", state: "Ohio", stateCode: "OH", zip: "43215" },
  { city: "Cleveland", state: "Ohio", stateCode: "OH", zip: "44113" },
  { city: "Cincinnati", state: "Ohio", stateCode: "OH", zip: "45202" },
  { city: "Toledo", state: "Ohio", stateCode: "OH", zip: "43604" },
  { city: "Kansas City", state: "Missouri", stateCode: "MO", zip: "64106" },
  { city: "St. Louis", state: "Missouri", stateCode: "MO", zip: "63101" },
  { city: "Wichita", state: "Kansas", stateCode: "KS", zip: "67202" },
  { city: "Omaha", state: "Nebraska", stateCode: "NE", zip: "68102" },
  { city: "Des Moines", state: "Iowa", stateCode: "IA", zip: "50309" },
  { city: "Nashville", state: "Tennessee", stateCode: "TN", zip: "37203" },
  { city: "Memphis", state: "Tennessee", stateCode: "TN", zip: "38103" },
  { city: "Knoxville", state: "Tennessee", stateCode: "TN", zip: "37902" },
  { city: "Louisville", state: "Kentucky", stateCode: "KY", zip: "40202" },
  { city: "Atlanta", state: "Georgia", stateCode: "GA", zip: "30303" },
  { city: "Savannah", state: "Georgia", stateCode: "GA", zip: "31401" },
  { city: "Charlotte", state: "North Carolina", stateCode: "NC", zip: "28202" },
  { city: "Raleigh", state: "North Carolina", stateCode: "NC", zip: "27601" },
  { city: "Greensboro", state: "North Carolina", stateCode: "NC", zip: "27401" },
  { city: "Columbia", state: "South Carolina", stateCode: "SC", zip: "29201" },
  { city: "Charleston", state: "South Carolina", stateCode: "SC", zip: "29401" },
  { city: "Birmingham", state: "Alabama", stateCode: "AL", zip: "35203" },
  { city: "Montgomery", state: "Alabama", stateCode: "AL", zip: "36104" },
  { city: "Jackson", state: "Mississippi", stateCode: "MS", zip: "39201" },
  { city: "New Orleans", state: "Louisiana", stateCode: "LA", zip: "70112" },
  { city: "Baton Rouge", state: "Louisiana", stateCode: "LA", zip: "70802" },
  { city: "Little Rock", state: "Arkansas", stateCode: "AR", zip: "72201" },
  { city: "Oklahoma City", state: "Oklahoma", stateCode: "OK", zip: "73102" },
  { city: "Tulsa", state: "Oklahoma", stateCode: "OK", zip: "74103" },
  { city: "Miami", state: "Florida", stateCode: "FL", zip: "33128" },
  { city: "Orlando", state: "Florida", stateCode: "FL", zip: "32801" },
  { city: "Tampa", state: "Florida", stateCode: "FL", zip: "33602" },
  { city: "Jacksonville", state: "Florida", stateCode: "FL", zip: "32202" },
  { city: "Fort Lauderdale", state: "Florida", stateCode: "FL", zip: "33301" },
  { city: "New York", state: "New York", stateCode: "NY", zip: "10007" },
  { city: "Brooklyn", state: "New York", stateCode: "NY", zip: "11201" },
  { city: "Buffalo", state: "New York", stateCode: "NY", zip: "14202" },
  { city: "Rochester", state: "New York", stateCode: "NY", zip: "14604" },
  { city: "Newark", state: "New Jersey", stateCode: "NJ", zip: "07102" },
  { city: "Jersey City", state: "New Jersey", stateCode: "NJ", zip: "07302" },
  { city: "Boston", state: "Massachusetts", stateCode: "MA", zip: "02108" },
  { city: "Worcester", state: "Massachusetts", stateCode: "MA", zip: "01608" },
  { city: "Providence", state: "Rhode Island", stateCode: "RI", zip: "02903" },
  { city: "Philadelphia", state: "Pennsylvania", stateCode: "PA", zip: "19107" },
  { city: "Pittsburgh", state: "Pennsylvania", stateCode: "PA", zip: "15222" },
  { city: "Baltimore", state: "Maryland", stateCode: "MD", zip: "21201" },
  { city: "Washington", state: "District of Columbia", stateCode: "DC", zip: "20001" },
  { city: "Richmond", state: "Virginia", stateCode: "VA", zip: "23219" },
  { city: "Virginia Beach", state: "Virginia", stateCode: "VA", zip: "23451" },
  { city: "Norfolk", state: "Virginia", stateCode: "VA", zip: "23510" },
  { city: "Charleston", state: "West Virginia", stateCode: "WV", zip: "25301" },
  { city: "Portland", state: "Maine", stateCode: "ME", zip: "04101" },
  { city: "Manchester", state: "New Hampshire", stateCode: "NH", zip: "03101" },
  { city: "Burlington", state: "Vermont", stateCode: "VT", zip: "05401" },
  { city: "Wilmington", state: "Delaware", stateCode: "DE", zip: "19801" },
  { city: "Billings", state: "Montana", stateCode: "MT", zip: "59101" },
  { city: "Cheyenne", state: "Wyoming", stateCode: "WY", zip: "82001" },
  { city: "Fargo", state: "North Dakota", stateCode: "ND", zip: "58102" },
  { city: "Sioux Falls", state: "South Dakota", stateCode: "SD", zip: "57104" },
  { city: "Honolulu", state: "Hawaii", stateCode: "HI", zip: "96813" },
  { city: "Anchorage", state: "Alaska", stateCode: "AK", zip: "99501" },
];

// All US states + DC for the state dropdown, so any typed city resolves to a
// clean "City, ST" label even when it isn't in the quick-pick list above.
const US_STATES: { name: string; code: string }[] = [
  { name: "Alabama", code: "AL" }, { name: "Alaska", code: "AK" }, { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" }, { name: "California", code: "CA" }, { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" }, { name: "Delaware", code: "DE" }, { name: "District of Columbia", code: "DC" },
  { name: "Florida", code: "FL" }, { name: "Georgia", code: "GA" }, { name: "Hawaii", code: "HI" },
  { name: "Idaho", code: "ID" }, { name: "Illinois", code: "IL" }, { name: "Indiana", code: "IN" },
  { name: "Iowa", code: "IA" }, { name: "Kansas", code: "KS" }, { name: "Kentucky", code: "KY" },
  { name: "Louisiana", code: "LA" }, { name: "Maine", code: "ME" }, { name: "Maryland", code: "MD" },
  { name: "Massachusetts", code: "MA" }, { name: "Michigan", code: "MI" }, { name: "Minnesota", code: "MN" },
  { name: "Mississippi", code: "MS" }, { name: "Missouri", code: "MO" }, { name: "Montana", code: "MT" },
  { name: "Nebraska", code: "NE" }, { name: "Nevada", code: "NV" }, { name: "New Hampshire", code: "NH" },
  { name: "New Jersey", code: "NJ" }, { name: "New Mexico", code: "NM" }, { name: "New York", code: "NY" },
  { name: "North Carolina", code: "NC" }, { name: "North Dakota", code: "ND" }, { name: "Ohio", code: "OH" },
  { name: "Oklahoma", code: "OK" }, { name: "Oregon", code: "OR" }, { name: "Pennsylvania", code: "PA" },
  { name: "Rhode Island", code: "RI" }, { name: "South Carolina", code: "SC" }, { name: "South Dakota", code: "SD" },
  { name: "Tennessee", code: "TN" }, { name: "Texas", code: "TX" }, { name: "Utah", code: "UT" },
  { name: "Vermont", code: "VT" }, { name: "Virginia", code: "VA" }, { name: "Washington", code: "WA" },
  { name: "West Virginia", code: "WV" }, { name: "Wisconsin", code: "WI" }, { name: "Wyoming", code: "WY" },
];

/** Builds the posted location label from city + state, e.g. "Fremont, CA". */
function deriveLocation(city: string, stateCode: string): string {
  const c = city.trim();
  const s = stateCode.trim();
  if (c && s) return `${c}, ${s}`;
  return c;
}

// Job-title → template intelligence now lives in @/lib/jd-templates so the same
// library powers both the browsable picker and title-match auto-fill.

// ─── Location Search ───────────────────────────────────────────────────────
// Deduplicated quick-pick list (some cities are listed more than once across the
// dataset) — keyed by city+state so suggestions never repeat.
const CITY_SUGGESTIONS: CityEntry[] = (() => {
  const seen = new Set<string>();
  const unique: CityEntry[] = [];
  for (const entry of US_CITIES) {
    const key = `${entry.city.toLowerCase()}|${entry.stateCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
})();

function searchCities(query: string): CityEntry[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  // Prefer prefix matches, then substring matches.
  const prefix = CITY_SUGGESTIONS.filter((entry) => entry.city.toLowerCase().startsWith(lower));
  const contains = CITY_SUGGESTIONS.filter(
    (entry) => !entry.city.toLowerCase().startsWith(lower) && entry.city.toLowerCase().includes(lower),
  );
  return [...prefix, ...contains].slice(0, 8);
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
  const [titleSuggestion, setTitleSuggestion] = useState<JdTemplate | null>(null);
  const [showTitleHint, setShowTitleHint] = useState(false);

  // AI description generation state
  const [generating, setGenerating] = useState(false);
  const [generateNote, setGenerateNote] = useState("");

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

  // Handle city input with autocomplete. Always keeps the posted location label
  // in sync with the typed city (+ current state), so any city works — not just
  // ones in the quick-pick list.
  const handleCityInput = useCallback((value: string) => {
    setValues((current) => ({
      ...current,
      city: value,
      location: deriveLocation(value, current.state),
    }));
    const results = searchCities(value);
    setCitySuggestions(results);
    setShowCitySuggestions(results.length > 0);
    setActiveSuggestionIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State dropdown — re-derive the location label from the current city.
  const handleStateSelect = useCallback((stateCode: string) => {
    setValues((current) => ({
      ...current,
      state: stateCode,
      location: deriveLocation(current.city, stateCode),
    }));
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
    const suggestion = matchTemplateByTitle(value);
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
      description: current.description || titleSuggestion.description,
    }));
    setShowTitleHint(false);
  }, [titleSuggestion]);

  // Explicit template picker — fills title (if empty), salary, type, and body.
  const applyTemplate = useCallback((templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return;
    setValues((current) => ({
      ...current,
      title: current.title || template.sampleTitle,
      employment_type: template.employment_type,
      salary_min: template.salary_min,
      salary_max: template.salary_max,
      salary_period: template.salary_period,
      description: template.description,
    }));
    setTitleSuggestion(null);
    setShowTitleHint(false);
  }, []);

  async function handleGenerateDescription() {
    if (!values.title.trim()) return;
    setGenerating(true);
    setGenerateNote("");
    try {
      const response = await fetch(`/api/o/${orgSlug}/jobs/generate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: values.title, location: values.location }),
      });
      const data = (await response.json()) as { description?: string; source?: string; error?: string };
      if (!response.ok || !data.description) {
        setGenerateNote(data.error ?? "Couldn't generate a description. Add an ANTHROPIC_API_KEY or use a template.");
        return;
      }
      updateField("description", data.description);
      setGenerateNote(
        data.source === "llm" ? "Generated with AI — review and edit before publishing." : "Filled from the closest template.",
      );
    } catch {
      setGenerateNote("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    // Ensure the posted location label is populated from city + state even if
    // the auto-fill was cleared. City is the required field that drives it.
    const payload = {
      ...values,
      location: values.location.trim() || deriveLocation(values.city, values.state),
    };

    const url = job ? `/api/o/${orgSlug}/jobs/${job.id}` : `/api/o/${orgSlug}/jobs`;
    const method = job ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Failed to save job");
      return;
    }

    // Celebrate a freshly published job on the dashboard (share link, flyer, QR).
    const data = (await response.json().catch(() => null)) as { job?: { slug?: string } } | null;
    const publishedSlug = !job && values.status === "published" ? data?.job?.slug : undefined;
    router.push(publishedSlug ? `/o/${orgSlug}/admin?published=${encodeURIComponent(publishedSlug)}` : `/o/${orgSlug}/admin`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Start-from-a-template picker */}
      <label className="block space-y-1">
        <span className="text-sm font-medium">Start from a template</span>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) applyTemplate(event.target.value);
            event.target.value = "";
          }}
          className="field-input"
        >
          <option value="">Choose a role template…</option>
          {JD_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">
          Fills the title, employment type, salary range, and a starter description you can edit.
        </span>
      </label>

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
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Description *</span>
          <button
            type="button"
            onClick={handleGenerateDescription}
            disabled={generating || !values.title.trim()}
            className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            {generating ? "Generating…" : "✨ Generate with AI"}
          </button>
        </div>
        <textarea
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="field-input min-h-48"
          placeholder="Job responsibilities, requirements, and qualifications..."
          required
        />
        {generateNote ? <span className="text-xs text-zinc-500">{generateNote}</span> : null}
      </label>

      {/* Location Section */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <legend className="px-2 text-sm font-semibold text-zinc-700">Location</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative block space-y-1">
            <span className="text-sm font-medium">City *</span>
            <input
              ref={cityInputRef}
              value={values.city}
              onChange={(event) => handleCityInput(event.target.value)}
              onFocus={() => {
                if (citySuggestions.length > 0) setShowCitySuggestions(true);
              }}
              onKeyDown={handleCityKeyDown}
              placeholder="Start typing any city name..."
              className="field-input"
              autoComplete="off"
              required
            />
            <span className="text-xs text-zinc-500">
              Pick a suggestion, or just keep typing — any city works.
            </span>

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
            <span className="text-sm font-medium">State *</span>
            <select
              value={values.state}
              onChange={(event) => handleStateSelect(event.target.value)}
              className="field-input"
              required
            >
              <option value="">Select a state…</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">Sets the posted location with your city.</span>
          </label>

          <label className="block space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Location label</span>
            <input
              value={values.location}
              onChange={(event) => handleLocationChange(event.target.value)}
              placeholder="Auto-filled from City and State"
              className="field-input bg-zinc-50"
            />
            <span className="text-xs text-zinc-500">
              This is what appears on job boards. Auto-filled from your city and state — edit it for a custom label like
              &quot;Remote&quot; or &quot;Bay Area&quot;.
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">ZIP</span>
            <input
              value={values.zip}
              onChange={(event) => updateField("zip", event.target.value)}
              placeholder="Optional"
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
