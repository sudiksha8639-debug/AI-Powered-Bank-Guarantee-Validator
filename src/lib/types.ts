export interface TemplateClause {
  id: string;
  label: string;
  content: string;
  order: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isScanned: boolean;
  confidence: number;
}

export type FindingStatus = "PASS" | "REVIEW" | "FAIL" | "INFO";

export type FindingCategory =
  | "Clause Validation"
  | "Consistency Validation"
  | "Logical Validation"
  | "Document Validation"
  | "Optional Information";

export interface ValidationFinding {
  id: string;
  category: FindingCategory;
  checkId: string;
  label: string;
  status: FindingStatus;
  detail: string;
  pageNumber?: number;
  extractedText?: string;
}

export type DocumentType = "DIGITAL" | "SCANNED" | "MIXED";

export type ProcessingStage =
  | "uploading"
  | "detecting"
  | "extracting"
  | "enhancing"
  | "ocr"
  | "validating"
  | "report"
  | "complete";

export interface ProcessingStatus {
  stage: ProcessingStage;
  message: string;
}

export interface ValidationResult {
  documentType: DocumentType;
  pageCount: number;
  status: "VALID" | "REVIEW" | "DISCREPANT";
  passCount: number;
  reviewCount: number;
  failCount: number;
  infoCount: number;
  findings: ValidationFinding[];
  extractedText: string;
}
