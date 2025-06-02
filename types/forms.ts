// Interface for NDA Request Form Data
export interface NdaRequestFormValues {
  disclosing_party_name: string;
  disclosing_party_address: string;
  receiving_party_name: string;
  receiving_party_address: string;
  effective_date: string; // Consider using a Date object or ensuring ISO string format if needed
  purpose_of_nda: string;
  definition_of_confidential_information: string;
  // Add any other NDA specific fields here
}

// Interface for General Consultation Form Data
export type PreferredContactMethod = 'email' | 'phone';

export interface GeneralConsultationFormValues {
  client_full_name: string;
  client_email: string;
  client_phone?: string; // Optional as per current form
  type_of_legal_issue: string;
  brief_description_of_issue: string;
  preferred_contact_method: PreferredContactMethod | ''; // Allow '' for initial unselected state in component
                                                       // Server-side will expect 'email' or 'phone'
}
