import type { TemplateClause } from "./types";

/**
 * Extract clauses from a template document's text.
 * Clauses are identified by common patterns:
 * - Numbered clauses (1., 2., etc.)
 * - Section headers (Section, Clause, Article)
 * - Roman numerals (I., II., III.)
 * - Lettered items (a), b), etc.)
 */
export function extractClauses(text: string): TemplateClause[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const clauses: TemplateClause[] = [];

  // Patterns for clause detection
  const clausePatterns = [
    /^(\d+)\.\s+(.+)/,                           // 1. Clause text
    /^(Clause|Section|Article)\s+(\d+[\.\w]*)\s*[:\-]?\s*(.+)/i,
    /^([IVX]+)\.\s+(.+)/,                         // Roman numerals
    /^(\d+\.\d+)\s+(.+)/,                         // 1.1 Sub-clause
    /^([A-Z][A-Z\s]{5,})\s*$/,                    // ALL CAPS headers
  ];

  let currentClause: TemplateClause | null = null;
  let clauseIndex = 0;

  for (const line of lines) {
    let matched = false;

    for (const pattern of clausePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Save previous clause
        if (currentClause) {
          clauses.push(currentClause);
        }

        clauseIndex++;
        const label = match[0].replace(/[:\-]+$/, "").trim();

        currentClause = {
          id: `clause_${clauseIndex}`,
          label: label.length > 100 ? label.substring(0, 100) : label,
          content: line,
          order: clauseIndex,
        };
        matched = true;
        break;
      }
    }

    if (!matched && currentClause) {
      currentClause.content += " " + line;
    }
  }

  // Don't forget the last clause
  if (currentClause) {
    clauses.push(currentClause);
  }

  // If no clauses detected, create a single clause with the full text
  if (clauses.length === 0 && text.trim().length > 0) {
    clauses.push({
      id: "clause_full",
      label: "Full Document",
      content: text.trim(),
      order: 1,
    });
  }

  return clauses;
}

/**
 * Extract key fields from template text (amount, dates, parties, etc.)
 */
export function extractTemplateFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};

  // BG/Guarantee number
  const bgNumberMatch = text.match(
    /(?:BG|Guarantee|Guaranty)\s*(?:No|Number|Ref)\.?\s*[:.]?\s*([A-Z0-9\/\-]+)/i
  );
  if (bgNumberMatch) fields.bgNumber = bgNumberMatch[1].trim();

  // Amount
  const amountMatch = text.match(
    /(?:Amount|Sum|Value)\s*(?:of|:)?\s*(?:Rs\.?|INR|USD|EUR|GBP)?\s*([\d,]+(?:\.\d{2})?)/i
  );
  if (amountMatch) fields.amount = amountMatch[1].trim();

  // Amount in words
  const wordsMatch = text.match(
    /(?:Rupees|Dollars|Euros|Pounds)\s+(.+?)(?:\s+only|\s*[,]|$)/i
  );
  if (wordsMatch) fields.amountInWords = wordsMatch[1].trim();

  // Dates
  const dateMatches = text.match(
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g
  );
  if (dateMatches) fields.dates = dateMatches.join(", ");

  // Contract/PO reference
  const contractMatch = text.match(
    /(?:Contract|PO|Purchase Order|LOA|FOA)\s*(?:No|Number|Ref)\.?\s*[:.]?\s*([A-Z0-9\/\-]+)/i
  );
  if (contractMatch) fields.contractRef = contractMatch[1].trim();

  // Beneficiary
  const beneficiaryMatch = text.match(
    /(?:Beneficiary|In favour of)\s*[:.]?\s*(.+?)(?:\n|$)/i
  );
  if (beneficiaryMatch) fields.beneficiary = beneficiaryMatch[1].trim();

  // Bank name
  const bankMatch = text.match(
    /(?:Bank|Issuing Bank|Guarantor)\s*[:.]?\s*(.+?)(?:\n|$)/i
  );
  if (bankMatch) fields.bank = bankMatch[1].trim();

  // Claim period
  const claimMatch = text.match(
    /(?:claim|validity|period)\s*(?:within|of|:)?\s*(.+?)(?:\n|days|months|year)/i
  );
  if (claimMatch) fields.claimPeriod = claimMatch[1].trim();

  // Expiry date
  const expiryMatch = text.match(
    /(?:expir[ey]|valid until|validity up to)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  );
  if (expiryMatch) fields.expiryDate = expiryMatch[1].trim();

  return fields;
}
