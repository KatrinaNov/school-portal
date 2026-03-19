import { useEffect, useMemo, useState } from "react";
import type { SubjectContent } from "./types";
import { fetchSubjectContentJson } from "./jsonSource";
import { fetchSubjectContentFirestore } from "./firestoreSource";

export type SubjectContentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; content: SubjectContent };

export function useSubjectContent(classId?: string, subjectId?: string): SubjectContentState {
  const deps = useMemo(() => ({ classId, subjectId }), [classId, subjectId]);
  const [state, setState] = useState<SubjectContentState>({ status: "idle" });

  useEffect(() => {
    if (!deps.classId || !deps.subjectId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    const run = async () => {
      try {
        // Prefer Firestore when available (public read), fallback to JSON for offline/guest resiliency.
        const fromFs = await fetchSubjectContentFirestore(deps.classId!, deps.subjectId!);
        if (fromFs.paragraphs.length > 0 || fromFs.quizzes.length > 0) return fromFs;
      } catch {
        // ignore and fallback
      }
      return await fetchSubjectContentJson(deps.classId!, deps.subjectId!);
    };

    run()
      .then((content) => {
        if (cancelled) return;
        setState({ status: "ready", content });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load content";
        setState({ status: "error", error: msg });
      });

    return () => {
      cancelled = true;
    };
  }, [deps.classId, deps.subjectId]);

  return state;
}

