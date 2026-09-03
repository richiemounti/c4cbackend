// lib/surveyQuestionOrdering.ts
// SurveyQuestion.order resets to 1, 2, 3... independently within each section
// (see the reorder/move endpoints in controllers/surveyQuestion.controller.ts) —
// it is never a single monotonic sequence across a whole survey. Anything that
// needs to list a survey's questions in the order they actually appear (exports,
// reports, etc.) must sort by section order first, then by question order
// within that section, with no-section questions placed last — a flat sort on
// the raw `order` field alone interleaves sections.
import mongoose from "mongoose";

interface SectionLike {
  _id: unknown;
  order: number;
}

interface SurveyQuestionLike {
  section?: mongoose.Types.ObjectId | string | null;
  order: number;
}

export function sortSurveyQuestionsByStructure<T extends SurveyQuestionLike>(
  surveyQuestions: T[],
  sections: SectionLike[]
): T[] {
  const sectionOrderById = new Map(
    sections.map(s => [String(s._id), s.order])
  );

  return [...surveyQuestions].sort((a, b) => {
    const aSectionOrder = a.section
      ? sectionOrderById.get(a.section.toString()) ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    const bSectionOrder = b.section
      ? sectionOrderById.get(b.section.toString()) ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;

    if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
    return a.order - b.order;
  });
}
