import { NdaRequestFormValues, GeneralConsultationFormValues } from './forms';

// Represents the 'data' field from the client_intake_data table,
// which contains the actual form submission values.
export type ClientIntakeDataContent = NdaRequestFormValues | GeneralConsultationFormValues | { [key: string]: any }; // Fallback for other/unknown form types

// Interface for the data returned by /api/get-client-intake-data
// This endpoint might return an array of records or a single merged object.
// Based on the component, it seems to expect a single object representing the data for a case.
// If multiple forms can be associated, this might need to be an array or a structured object.
// For now, assuming it's a single object which is the `data` field of a client_intake_data record.
export type ClientIntakeData = ClientIntakeDataContent | null;


export interface Template {
  id: string;
  name: string;
  description: string;
}

export interface DocumentTaskResult {
  file_name?: string; // Changed from filename for consistency
  file_path?: string; // Or storage_url, storage_path
  storage_path?: string; // Path within the bucket
  bucket_name?: string;  // Name of the storage bucket
  // Potentially other fields like document_id, download_url (if not signed immediately)
  [key: string]: any; // Allow other properties
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'not_found' | 'unknown';

export interface DocumentTaskStatusResponse {
  status: TaskStatus;
  message?: string;
  details?: any; // Could be more specific if error details structure is known
  result?: DocumentTaskResult | null;
  task_id: string;
  // Older structure from backend response might have error_message directly
  error_message?: string; 
  // Backend also sends 'filename' in result, ensure consistency or map it.
}
