import type { EvidenceItem } from "./types";

export type EvidenceKind = "market" | "material" | "preference" | "inferred";

export type EvidenceArgument = {
  title: string;
  detail?: string;
  href?: string;
  external?: boolean;
  kind?: EvidenceKind;
};

export type EvidenceRow = {
  point: string;
  arguments: EvidenceArgument[];
};

export type EvidenceDialogState = {
  title: string;
  rows: EvidenceRow[];
};

export type EvidenceTarget = {
  href: string;
  label: string;
  external: boolean;
};

export const PREFERENCE_HREF = "/?view=preference";

export function evidenceIds(claim: { evidence_ids?: string[] } | undefined): string[] {
  return claim?.evidence_ids ?? [];
}

export function evidenceTarget(evidence: EvidenceItem | undefined): EvidenceTarget | null {
  if (!evidence) return null;
  const url = evidence.url?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    return { href: url, label: "查看详情", external: true };
  }

  const raw = evidence.raw ?? {};
  const dealId = typeof raw.deal_id === "string" ? raw.deal_id : null;
  const documentId = typeof raw.document_id === "string" ? raw.document_id : null;
  if (dealId) {
    const suffix = documentId ? `#material-${encodeURIComponent(documentId)}` : "";
    return { href: `/workspace/${dealId}${suffix}`, label: "查看材料", external: false };
  }
  return null;
}

function evidenceKind(evidence: EvidenceItem): EvidenceKind {
  if (evidence.url) return "market";
  const raw = evidence.raw ?? {};
  if (typeof raw.deal_id === "string" || typeof raw.document_id === "string") return "material";
  return "market";
}

export function argumentFromEvidence(evidence: EvidenceItem): EvidenceArgument {
  const target = evidenceTarget(evidence);
  return {
    title: evidence.title || "未命名证据",
    detail: evidence.snippet || evidence.published_at || undefined,
    href: target?.href,
    external: target?.external,
    kind: evidenceKind(evidence),
  };
}
