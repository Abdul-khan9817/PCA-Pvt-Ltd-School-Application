export const TERMS_LIST = ["First Term", "Second Term", "Third Term", "Final"];

export const TERM_FIELD_MAP = {
  "First Term": "firstTerm",
  "Second Term": "secondTerm",
  "Third Term": "thirdTerm",
  Final: "final",
};

export const getMaxMarks = (subject, term) => {
  const max = subject?.[TERM_FIELD_MAP[term]];
  return max && max > 0 ? max : 100;
};