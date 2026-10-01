export const idOf = value => value?._id || value?.id || value || "";

export const classLabel = value =>
  [value?.name || value?.gradeLevel, value?.section].filter(Boolean).join(" - ");