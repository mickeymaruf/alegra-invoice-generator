export interface AlegraClient {
  id: number | string;
  name: string;
  identification?: string;
}

export interface AlegraNumberTemplate {
  id: number | string;
  prefix?: string;
  number?: string;
  fullNumber?: string;
  formattedNumber?: string;
  documentType?: string;
  subDocumentType?: string; // e.g., "INVOICE_C", "INVOICE_A"
}

export interface Invoice {
  id: number | string;
  date: string;
  dueDate: string;
  total: number;
  balance?: number;
  status: "open" | "draft" | "closed" | "void" | string;
  client?: {
    id: number | string;
    name: string;
  };
  numberTemplate?: AlegraNumberTemplate;
  number?: string;
}
