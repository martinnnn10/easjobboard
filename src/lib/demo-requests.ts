import { randomUUID } from "crypto";
import { getDb } from "./db";

export type DemoRequestInput = {
  name: string;
  email: string;
  company?: string;
  role?: string;
  challenge?: string;
  notes?: string;
};

/** Store an inbound "Book a demo" request from the public site. */
export function createDemoRequest(input: DemoRequestInput): { id: string } {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO demo_requests (id, name, email, company, role, challenge, notes, created_at)
       VALUES (@id, @name, @email, @company, @role, @challenge, @notes, @created_at)`,
    )
    .run({
      id,
      name: input.name.trim().slice(0, 200),
      email: input.email.trim().slice(0, 200),
      company: (input.company ?? "").trim().slice(0, 200),
      role: (input.role ?? "").trim().slice(0, 200),
      challenge: (input.challenge ?? "").trim().slice(0, 2000),
      notes: (input.notes ?? "").trim().slice(0, 2000),
      created_at: new Date().toISOString(),
    });
  return { id };
}
