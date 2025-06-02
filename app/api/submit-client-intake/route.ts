import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Zod Schemas for Validation
const NdaRequestFormDataSchema = z.object({
  disclosing_party_name: z.string().min(1, "Disclosing party name is required"),
  disclosing_party_address: z.string().min(1, "Disclosing party address is required"),
  receiving_party_name: z.string().min(1, "Receiving party name is required"),
  receiving_party_address: z.string().min(1, "Receiving party address is required"),
  effective_date: z.string().min(1, "Effective date is required"), // Consider adding .date() if format is strict
  purpose_of_nda: z.string().min(1, "Purpose of NDA is required"),
  definition_of_confidential_information: z.string().min(1, "Definition of confidential information is required"),
  // Add other NDA specific fields here if any
});

const GeneralConsultationFormDataSchema = z.object({
  client_full_name: z.string().min(1, "Full name is required"),
  client_email: z.string().email("Invalid email address"),
  client_phone: z.string().optional(), // Basic validation, can be stricter
  type_of_legal_issue: z.string().min(1, "Type of legal issue is required"),
  brief_description_of_issue: z.string().min(10, "Brief description must be at least 10 characters"),
  preferred_contact_method: z.enum(['email', 'phone'], { message: "Preferred contact method must be 'email' or 'phone'" }),
  // Add other general consultation specific fields here if any
});

// Discriminated union for the request body
const SubmitClientIntakeBodySchema = z.discriminatedUnion("form_type", [
  z.object({
    case_id: z.string().uuid("Invalid Case ID format"),
    form_type: z.literal("nda_request"),
    formData: NdaRequestFormDataSchema,
  }),
  z.object({
    case_id: z.string().uuid("Invalid Case ID format"),
    form_type: z.literal("general_consultation"),
    formData: GeneralConsultationFormDataSchema,
  }),
]);

/*
Recommended SQL Schema for `client_intake_data` table:

CREATE TABLE IF NOT EXISTS public.client_intake_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL, -- e.g., 'nda_request', 'general_consultation'
    data JSONB NOT NULL,     -- Stores the actual validated form data
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Add a unique constraint if you only want one intake form of a specific type per case
-- CREATE UNIQUE INDEX IF NOT EXISTS client_intake_data_case_id_form_type_idx 
-- ON public.client_intake_data (case_id, form_type);

-- Trigger to automatically update `updated_at` timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_client_intake_data_updated_at
BEFORE UPDATE ON public.client_intake_data
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.client_intake_data ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Allow authenticated users to insert their own intake data
CREATE POLICY "Allow authenticated insert own client_intake_data"
ON public.client_intake_data
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_user_id);

-- Allow users to view their own intake data
CREATE POLICY "Allow authenticated read own client_intake_data"
ON public.client_intake_data
FOR SELECT
TO authenticated
USING (auth.uid() = client_user_id);

-- Allow users to update their own intake data
CREATE POLICY "Allow authenticated update own client_intake_data"
ON public.client_intake_data
FOR UPDATE
TO authenticated
USING (auth.uid() = client_user_id)
WITH CHECK (auth.uid() = client_user_id);

-- Staff/Admins might need broader access (e.g., service_role or specific role-based policies)
-- Example: Allow service_role to bypass RLS (typically default but good to be explicit if needed)
-- CREATE POLICY "Allow service_role all access on client_intake_data"
-- ON public.client_intake_data
-- FOR ALL
-- TO service_role; -- Or your specific admin/staff role
*/


export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return NextResponse.json({ error: 'Failed to get session', details: sessionError.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No active session.' }, { status: 401 });
    }
    const clientUserId = session.user.id;

    // 2. Request Body Parsing & Validation
    let body;
    try {
      body = await request.json();
    } catch (e: any) {
      return NextResponse.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
    }
    
    const validationResult = SubmitClientIntakeBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { case_id, form_type, formData } = validationResult.data;

    // 3. Store Data in Supabase (Upsert-like logic: select then insert/update)
    // This logic assumes one intake form of a specific type per case.
    // If multiple forms of the same type are allowed per case, this needs adjustment (e.g. remove form_type from eq).
    const { data: existingIntake, error: fetchError } = await supabase
      .from('client_intake_data')
      .select('id')
      .eq('case_id', case_id)
      .eq('form_type', form_type) // Only update if same case AND same form type
      .eq('client_user_id', clientUserId) // Ensure user can only update their own existing forms
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing client intake data:', fetchError.message);
      return NextResponse.json({ error: 'Database error while checking existing data.', details: fetchError.message }, { status: 500 });
    }

    let upsertError = null;
    let statusToReturn = 200; // Default to 200 OK (for update)

    if (existingIntake?.id) {
      // Update existing record
      const { error } = await supabase
        .from('client_intake_data')
        .update({ data: formData, updated_at: new Date().toISOString() }) // client_user_id and form_type shouldn't change for an existing record by the same user
        .eq('id', existingIntake.id);
      upsertError = error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('client_intake_data')
        .insert({
          case_id: case_id,
          client_user_id: clientUserId,
          form_type: form_type,
          data: formData,
        });
      upsertError = error;
      if (!upsertError) {
        statusToReturn = 201; // 201 Created for new record
      }
    }

    if (upsertError) {
      console.error('Error upserting client intake data:', upsertError.message);
      return NextResponse.json({ error: 'Failed to save intake data to database.', details: upsertError.message }, { status: 500 });
    }

    // 4. Return Success Response
    return NextResponse.json({ message: 'Intake data submitted successfully.' }, { status: statusToReturn });

  } catch (error: any) {
    // Catch any other unexpected errors
    console.error('Unexpected error in /api/submit-client-intake:', error.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.', details: error.message }, { status: 500 });
  }
}
