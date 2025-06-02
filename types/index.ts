export interface Case {
  id: string;
  case_number?: string;
  client_name?: string; // This might be the client's name or the case's name/title
  status?: string;
  case_type?: string; // e.g., "NDA Request", "General Consultation" - could be an enum
  // Add other relevant case properties here, for example:
  // created_at?: string;
  // updated_at?: string;
  // client_user_id?: string; 
}

export type PageMessageType = 'success' | 'error' | 'info';

export interface PageMessage {
  type: PageMessageType;
  text: string;
  details?: string; // Optional field for more detailed error messages
}
