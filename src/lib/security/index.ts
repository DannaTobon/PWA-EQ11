export {
  INSPECTION_FIELDS,
  INSPECTION_LIMITS,
  MAX_INSPECTION_REQUEST_BYTES,
  hasOwn,
  isPlainObject,
  validateInspection,
  validateInspectionMutation,
  type InspectionMutation,
  type ValidationIssue,
  type ValidationIssueCode,
  type ValidationResult
} from "@/lib/security/validation";

export {
  clearLocalApplicationData,
  type LocalDataPurgeReport
} from "@/lib/security/privacy";
