import type { SubjectContent } from "./types";

type CacheKey = string;

const cache = new Map<CacheKey, Promise<SubjectContent>>();

function key(classId: string, subjectId: string) {
  return `${classId}/${subjectId}`;
}

export function fetchSubjectContentJson(classId: string, subjectId: string): Promise<SubjectContent> {
  const k = key(classId, subjectId);
  const existing = cache.get(k);
  if (existing) return existing;

  const p = (async () => {
    const url = `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/content.json`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    const data = (await res.json()) as SubjectContent;
    return data;
  })();

  cache.set(k, p);
  return p;
}

