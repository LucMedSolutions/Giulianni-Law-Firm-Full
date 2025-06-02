import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define allowed MIME types and max file size
// These should ideally match or be stricter than client-side checks
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/jpeg',
  'image/png',
  'text/plain', // .txt
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv', // .csv
];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

// Target buckets for validation. Add others like 'generated_documents' if needed by your app.
const TARGET_BUCKETS = ['documents']; 

console.log('Validate Upload Edge Function Initializing...');
console.log(`Allowed MIME types: ${ALLOWED_MIME_TYPES.join(', ')}`);
console.log(`Max file size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
console.log(`Target buckets: ${TARGET_BUCKETS.join(', ')}`);


serve(async (req: Request) => {
  try {
    const payload = await req.json();
    // Log only a summary of the payload to avoid exposing sensitive data in logs if any.
    console.log('Received webhook payload - Type:', payload.type, 'Table:', payload.table, 'Schema:', payload.schema);

    // Check if it's a storage object insertion event
    if (payload.type !== 'INSERT' || !payload.record || payload.schema !== 'storage' || payload.table !== 'objects') {
      console.log('Not a new storage object event or incorrect type/schema/table. Skipping.');
      return new Response(JSON.stringify({ message: 'Not a relevant storage event.' }), { status: 200 });
    }
    
    const record = payload.record; // This is the new row from storage.objects
    const bucketId = record.bucket_id;
    const objectPath = record.name; // Full path including filename (e.g., "public/avatar1.png")
    const objectId = record.id;     // UUID of the storage object in storage.objects table

    if (!bucketId || !objectPath || !objectId) {
        console.warn('Essential data (bucket_id, name, id) missing from storage.objects record:', record);
        // This indicates an issue with the webhook payload or the trigger setup.
        // Don't want to error every non-object-creation hook if the webhook is misconfigured more broadly.
        return new Response(JSON.stringify({ error: 'Essential data missing from webhook record.' }), { status: 200 }); // Return 200 to prevent webhook retries for fundamentally bad payload
    }

    console.log(`Processing new object: ID=${objectId}, Path=${objectPath}, Bucket=${bucketId}`);

    if (!TARGET_BUCKETS.includes(bucketId)) {
      console.log(`Bucket ${bucketId} is not targeted for validation. Skipping object ${objectPath}.`);
      return new Response(JSON.stringify({ message: `Bucket ${bucketId} not targeted for validation.` }), { status: 200 });
    }

    // The 'record' from a storage.objects webhook payload should contain the 'metadata' object.
    const metadata = record.metadata; 
    if (!metadata || typeof metadata !== 'object') {
        console.error(`Metadata missing or not an object for object ${objectId} (Path: ${objectPath}) in bucket ${bucketId}. Cannot validate.`);
        // This is unexpected for a storage.objects trigger.
        // It's safer to delete the file if we can't ascertain its validity in a targeted bucket.
        // However, if metadata is truly missing, we might not have size/mimetype for validation error message.
        // For now, attempt deletion with a generic validation error.
        // Fall through to validationError logic, which will attempt deletion.
    }

    const size = metadata?.size ?? null; // Supabase metadata object has 'size'
    const mimetype = metadata?.mimetype ?? null; // Supabase metadata object has 'mimetype'

    console.log(`Validating Object ID: ${objectId} - Path: ${objectPath} - Size: ${size}, Mimetype: ${mimetype}`);

    let validationError = null;
    if (mimetype === null || size === null) {
        validationError = `Metadata (mimetype or size) could not be determined for file ${objectPath}. File cannot be validated.`;
    } else if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      validationError = `Invalid file type: ${mimetype}. Allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}.`;
    } else if (size > MAX_FILE_SIZE_BYTES) {
      validationError = `File size ${size} bytes exceeds the limit of ${MAX_FILE_SIZE_BYTES} bytes (${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB).`;
    }

    if (validationError) {
      console.warn(`Validation failed for ${objectPath} in bucket ${bucketId}: ${validationError}`);
      
      // Initialize Supabase Admin Client to delete the invalid file
      const supabaseAdminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_KEY')!
      );

      const { error: deleteError } = await supabaseAdminClient.storage
        .from(bucketId)
        .remove([objectPath]); // .remove() expects an array of paths

      if (deleteError) {
        console.error(`Failed to delete invalid file ${objectPath} from bucket ${bucketId}:`, deleteError.message);
        // Return 500 because we failed to remediate a validation failure.
        return new Response(JSON.stringify({ 
            error: `File validation failed and an subsequent error occurred while attempting to delete the invalid file.`, 
            validation_error: validationError,
            deletion_error: deleteError.message 
        }), { status: 500 });
      }
      
      console.log(`Successfully deleted invalid file ${objectPath} from bucket ${bucketId} due to validation error: ${validationError}`);
      // Return a specific status (e.g., 403 or 400) to indicate validation failure and deletion.
      // Using 400 as it's a client error (bad file). Or 415 for unsupported media type.
      return new Response(JSON.stringify({ error: `File rejected and deleted: ${validationError}` }), { status: 400 }); 
    }

    console.log(`File ${objectPath} (ID: ${objectId}) in bucket ${bucketId} validated successfully.`);
    return new Response(JSON.stringify({ success: true, message: 'File validated successfully.' }), { status: 200 });

  } catch (error) {
    console.error('Critical Error in Edge Function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
  }
});
