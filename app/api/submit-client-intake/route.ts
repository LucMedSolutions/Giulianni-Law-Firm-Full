import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}

const SUPABASE_TIMEOUT_MS = 10000; // 10 seconds, adjust as needed
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Zod Schemas for Validation
const NdaRequestFormDataSchema = z.object({
  disclosing_party_name: z.string().min(1, "Disclosing party name is required").trim().max(255),
  disclosing_party_address: z.string().min(1, "Disclosing party address is required").trim().max(255),
  receiving_party_name: z.string().min(1, "Receiving party name is required").trim().max(255),
  receiving_party_address: z.string().min(1, "Receiving party address is required").trim().max(255),
  effective_date: z.string().min(1, "Effective date is required").trim().pipe(z.coerce.date()),
  purpose_of_nda: z.string().min(1, "Purpose of NDA is required").trim().max(5000),
  definition_of_confidential_information: z.string().min(1, "Definition of confidential information is required").trim().max(5000),
  // Add other NDA specific fields here if any
});

const GeneralConsultationFormDataSchema = z.object({
  client_full_name: z.string().min(1, "Full name is required").trim().max(255),
  client_email: z.string().trim().email("Invalid email address").max(255),
  client_phone: z.string().trim().max(50).optional(), // Basic validation, can be stricter
  type_of_legal_issue: z.string().min(1, "Type of legal issue is required").trim().max(255),
  brief_description_of_issue: z.string().min(10, "Brief description must be at least 10 characters").trim().max(5000),
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
    const { data: { session }, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout getting session')
    );
    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      const status = sessionError.message === 'Timeout getting session' ? 504 : 500;
      return NextResponse.json({ error: 'Failed to get session', details: sessionError.message }, { status });
    }
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: No active session.' }, { status: 401 });
    }
    const clientUserId = session.user.id;

    // 2. Request Body Parsing & Validation
    let body;
    try {
      body = await request.json(); // This is a network request, but typically very fast. Timeout might be overkill unless large bodies are expected.
    } catch (e: any) {
      return NextResponse.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
    }
    
    const validationResult = SubmitClientIntakeBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { case_id, form_type, formData } = validationResult.data;

    // 3. Store Data in Supabase (Upsert-like logic: select then insert/update)
    const { data: existingIntake, error: fetchError } = await withTimeout(
      supabase
        .from('client_intake_data')
        .select('id')
        .eq('case_id', case_id)
        .eq('form_type', form_type)
        .eq('client_user_id', clientUserId)
        .maybeSingle(),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout checking for existing client intake data')
    );

    if (fetchError) {
      console.error('Error checking for existing client intake data:', fetchError.message);
      const status = fetchError.message === 'Timeout checking for existing client intake data' ? 504 : 500;
      return NextResponse.json({ error: 'Database error while checking existing data.', details: fetchError.message }, { status });
    }

    let upsertResponse = null;
    let statusToReturn = 200; // Default to 200 OK (for update)

    if (existingIntake?.id) {
      // Update existing record
      upsertResponse = await withTimeout(
        supabase
          .from('client_intake_data')
          .update({ data: formData, updated_at: new Date().toISOString() })
          .eq('id', existingIntake.id)
          .select('id') // Optionally select to confirm update, though not strictly needed here
          .single(), // Ensure we get a response or error for the single record
        SUPABASE_TIMEOUT_MS,
        new Error('Timeout updating client intake data')
      );
    } else {
      // Insert new record
      upsertResponse = await withTimeout(
        supabase
          .from('client_intake_data')
          .insert({
            case_id: case_id,
            client_user_id: clientUserId,
            form_type: form_type,
            data: formData,
          })
          .select('id') // Select to confirm insert
          .single(), // Ensure we get a response or error for the single record
        SUPABASE_TIMEOUT_MS,
        new Error('Timeout inserting client intake data')
      );
      if (!upsertResponse.error) {
        statusToReturn = 201; // 201 Created for new record
      }
    }

    if (upsertResponse.error) {
      console.error('Error upserting client intake data:', upsertResponse.error.message);
      const status = upsertResponse.error.message.startsWith('Timeout') ? 504 : 500;
      return NextResponse.json({ error: 'Failed to save intake data to database.', details: upsertResponse.error.message }, { status });
    }

    // 4. Return Success Response
    return NextResponse.json({ message: 'Intake data submitted successfully.', data: upsertResponse.data }, { status: statusToReturn });

  } catch (error: any) {
    // Catch any other unexpected errors, including timeouts not caught by specific handlers
    console.error('Unexpected error in /api/submit-client-intake:', error.message, error);
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return NextResponse.json({ error: 'An operation timed out.', details: error.message }, { status: 504 });
    }
    return NextResponse.json({ error: 'An unexpected server error occurred.', details: error.message }, { status: 500 });
  }
}
