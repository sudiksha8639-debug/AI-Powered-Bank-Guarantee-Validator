import type { ValidationFinding } from "./types";

/**
 * Map instruction keywords to check IDs and finding labels.
 * Each key is a concept the user might ask about.
 * The values are patterns to match against checkId, label, and detail.
 */
const KEYWORD_MAP: Record<string, string[]> = {
  amount: ["amount", "figures", "words", "currency", "rupees", "lakh", "crore", "value", "sum", "inr"],
  beneficiary: ["beneficiary", "favour", "favor", "payee", "recipient"],
  bank: ["bank", "issuing", "institution", "branch", "ifsc", "swift"],
  date: ["date", "expiry", "claim", "validity", "period", "issue", "expir"],
  signature: ["signature", "signatory", "authorized", "authorised", "signing", "power of attorney"],
  stamp: ["stamp", "estamp", "e-stamp", "duty", "non-judicial"],
  clause: ["clause", "paragraph", "condition", "terms", "undertake", "irrevocable"],
  contract: ["contract", "purchase order", "loa", "foa", "reference", "agreement"],
  bg_number: ["guarantee number", "bg number", "bg no", "reference number"],
  irrevocable: ["irrevocable", "revocable"],
  unconditional: ["unconditional", "conditional"],
  demand: ["demand", "first demand", "on demand", "at first demand"],
  jurisdiction: ["jurisdiction", "governing law", "court", "delhi"],
  structure: ["structure", "layout", "format", "title", "header"],
  quality: ["quality", "ocr", "scanned", "garbled", "text quality"],
};

/**
 * Parse user instructions and return a set of matching finding IDs.
 * If no instructions or empty string, returns null (meaning show all).
 */
type FindingLike = { id?: string; _id?: string; checkId: string; label: string; detail: string; status: string; category: string; pageNumber?: number; extractedText?: string };

export function matchInstructionsToFindings(
  userInstructions: string | undefined | null,
  findings: FindingLike[],
): string[] | null {
  if (!userInstructions || !userInstructions.trim()) return null;

  const instructions = userInstructions
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  if (instructions.length === 0) return null;

  const matchedIds = new Set<string>();

  for (const instruction of instructions) {
    const lower = instruction.toLowerCase();

    // Find which concepts this instruction touches
    for (const [concept, keywords] of Object.entries(KEYWORD_MAP)) {
      const matches = keywords.some((kw) => lower.includes(kw));
      if (!matches) continue;

      // Find findings that match this concept
      for (const f of findings) {
        const fLower = (f.checkId + " " + f.label + " " + f.detail).toLowerCase();
        if (keywords.some((kw) => fLower.includes(kw))) {
          matchedIds.add(f.id || String(f._id));
        }
      }
    }
  }

  return matchedIds.size > 0 ? [...matchedIds] : [];
}

/**
 * Determine the verdict for a filtered set of findings.
 */
export function filteredVerdict(
  findings: ValidationFinding[],
  matchedIds: string[],
): "PASS" | "REVIEW" | "FAIL" {
  const matched = findings.filter((f) => matchedIds.includes(f.id));
  if (matched.some((f) => f.status === "FAIL")) return "FAIL";
  if (matched.some((f) => f.status === "REVIEW")) return "REVIEW";
  return "PASS";
}
