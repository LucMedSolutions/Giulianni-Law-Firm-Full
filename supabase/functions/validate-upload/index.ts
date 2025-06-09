import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Configuration ---
console.log('Validate Upload Edge Function Initializing...');

// 1. Allowed MIME Types
const defaultMimeTypes = [
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
const mimeTypesEnv = Deno.env.get('VALIDATE_UPLOAD_ALLOWED_MIME_TYPES');
const ALLOWED_MIME_TYPES = mimeTypesEnv
  ? mimeTypesEnv.split(',').map(s => s.trim()).filter(s => s)
  : defaultMimeTypes;

if (mimeTypesEnv && ALLOWED_MIME_TYPES.length === 0 && mimeTypesEnv.trim() !== '') {
  // Handles case where env var is set but results in empty array (e.g. " , ,, ")
  // but was not empty string initially. This indicates a likely misconfiguration.
  console.warn(`VALIDATE_UPLOAD_ALLOWED_MIME_TYPES was set to "${mimeTypesEnv}" but resulted in an empty list after parsing. Using default MIME types.`);
  // ALLOWED_MIME_TYPES = defaultMimeTypes; // This line is redundant due to the filter and ternary, but explicit if needed.
  // If ALLOWED_MIME_TYPES is empty after parsing a non-empty env var, it will effectively block all uploads unless defaults are re-applied.
  // For safety, if parsing a non-empty env var leads to zero valid types, it might be better to fall back to defaults or have a minimal safe default.
  // However, the current logic (filter(s=>s)) means an empty list is possible if the env var is just commas/whitespace.
  // If the intention is that *any* non-empty setting of the env var that parses to empty should use defaults, then an explicit reassignment is needed.
  // For now, if it parses to empty, it means no types are allowed (unless it was empty string, then defaults apply)
}


if (mimeTypesEnv) {
  if (ALLOWED_MIME_TYPES.length > 0) {
    console.log(`Using ALLOWED_MIME_TYPES from environment variable: ${ALLOWED_MIME_TYPES.join(', ')}`);
  } else {
    // This case means env var was set (e.g. " , ") but resulted in no valid mime types.
    // This will effectively block all uploads based on MIME type.
    console.warn(`Warning: VALIDATE_UPLOAD_ALLOWED_MIME_TYPES environment variable ("${mimeTypesEnv}") resulted in an empty list. No MIME types will be allowed.`);
  }
} else {
  console.log(`Using default ALLOWED_MIME_TYPES: ${ALLOWED_MIME_TYPES.join(', ')}`);
}


// 2. Max File Size
const defaultMaxSizeMB = 15;
const maxSizeMBEnv = Deno.env.get('VALIDATE_UPLOAD_MAX_FILE_SIZE_MB');
let MAX_FILE_SIZE_BYTES = defaultMaxSizeMB * 1024 * 1024; // Default

if (maxSizeMBEnv) {
    const parsedSize = parseInt(maxSizeMBEnv, 10);
    if (!isNaN(parsedSize) && parsedSize > 0) {
        MAX_FILE_SIZE_BYTES = parsedSize * 1024 * 1024;
        console.log(`Using MAX_FILE_SIZE_BYTES from environment variable: ${parsedSize}MB (${MAX_FILE_SIZE_BYTES} bytes)`);
    } else {
        console.warn(`Invalid or zero VALIDATE_UPLOAD_MAX_FILE_SIZE_MB: "${maxSizeMBEnv}". Using default ${defaultMaxSizeMB}MB.`);
        console.log(`Using default MAX_FILE_SIZE_BYTES: ${defaultMaxSizeMB}MB (${MAX_FILE_SIZE_BYTES} bytes)`);
    }
} else {
    console.log(`Using default MAX_FILE_SIZE_BYTES: ${defaultMaxSizeMB}MB (${MAX_FILE_SIZE_BYTES} bytes)`);
}

// 3. Target Buckets
const defaultTargetBuckets = ['documents'];
const targetBucketsEnv = Deno.env.get('VALIDATE_UPLOAD_TARGET_BUCKETS');
const TARGET_BUCKETS = targetBucketsEnv
  ? targetBucketsEnv.split(',').map(s => s.trim()).filter(s => s)
  : defaultTargetBuckets;

if (targetBucketsEnv && TARGET_BUCKETS.length === 0 && targetBucketsEnv.trim() !== '') {
   console.warn(`VALIDATE_UPLOAD_TARGET_BUCKETS was set to "${targetBucketsEnv}" but resulted in an empty list after parsing. Using default target buckets.`);
   // TARGET_BUCKETS = defaultTargetBuckets; // Similar to MIME types, decide if explicit fallback is needed here.
}

if (targetBucketsEnv) {
  if (TARGET_BUCKETS.length > 0) {
    console.log(`Using TARGET_BUCKETS from environment variable: ${TARGET_BUCKETS.join(', ')}`);
  } else {
    console.warn(`Warning: VALIDATE_UPLOAD_TARGET_BUCKETS environment variable ("${targetBucketsEnv}") resulted in an empty list. No buckets will be targeted for validation.`);
  }
} else {
  console.log(`Using default TARGET_BUCKETS: ${TARGET_BUCKETS.join(', ')}`);
}
// --- End Configuration ---


serve(async (req: Request) => {
  try {
    const payload = await req.json();
    // Log only a summary of the payload to avoid exposing sensitive data in logs if any.
    console.log('Received webhook payload - Type:', payload.type, 'Table:', payload.table, 'Schema:', payload.schema);

    // Check if it's a storage object insertion event
    if (payload.type !== 'INSERT' || !payload.record || payload.schema !== 'storage' || payload.table !== 'objects') {
      console.log('Not a new storage object event or incorrect type/schema/table. Skipping.');
      return new Response(null, { status: 204 });
    }
    
    const record = payload.record; // This is the new row from storage.objects
    const bucketId = record.bucket_id;
    const objectPath = record.name; // Full path including filename (e.g., "public/avatar1.png")
    const objectId = record.id;     // UUID of the storage object in storage.objects table

    if (!bucketId || !objectPath || !objectId) {
        console.warn('Essential data (bucket_id, name, id) missing from storage.objects record:', record);
    return new Response(JSON.stringify({ error: 'Essential data missing from webhook record.' }), { status: 400 });
    }

    console.log(`Processing new object: ID=${objectId}, Path=${objectPath}, Bucket=${bucketId}`);

    if (TARGET_BUCKETS.length === 0) {
      // This case means no buckets are targeted, possibly due to env var misconfiguration.
      // Log this situation. Depending on desired behavior, could return 200 or an error/warning.
      // For now, it means no validation will occur if TARGET_BUCKETS is empty.
      console.log('No target buckets configured for validation. Skipping object validation.');
      return new Response(JSON.stringify({ message: 'No target buckets configured for validation. Skipping.' }), { status: 200 });
    }

    if (!TARGET_BUCKETS.includes(bucketId)) {
      console.log(`Bucket ${bucketId} is not targeted for validation. Skipping object ${objectPath}.`);
      return new Response(JSON.stringify({ message: `Bucket ${bucketId} not targeted for validation.` }), { status: 200 });
    }

    // The 'record' from a storage.objects webhook payload should contain the 'metadata' object.
    const metadata = record.metadata; 
    if (!metadata || typeof metadata !== 'object') {
        console.error(`Metadata missing or not an object for object ${objectId} (Path: ${objectPath}) in bucket ${bucketId}. Cannot validate.`);
        // Fall through to validationError logic, which will attempt deletion.
    }

    const size = metadata?.size ?? null; // Supabase metadata object has 'size'
    const mimetype = metadata?.mimetype ?? null; // Supabase metadata object has 'mimetype'

    console.log(`Validating Object ID: ${objectId} - Path: ${objectPath} - Size: ${size}, Mimetype: ${mimetype}`);

    let validationError = null;
    if (mimetype === null || size === null) {
        validationError = `Metadata (mimetype or size) could not be determined for file ${objectPath}. File cannot be validated.`;
    } else if (ALLOWED_MIME_TYPES.length === 0) {
        // If ALLOWED_MIME_TYPES is empty (e.g. due to env var misconfig), all files with metadata will be rejected.
        validationError = `No MIME types are allowed for upload. File ${objectPath} rejected. Please check function configuration.`;
        console.warn(validationError); // Log this specific configuration issue
    } else if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      validationError = `Invalid file type: ${mimetype}. Allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}.`;
    } else if (size > MAX_FILE_SIZE_BYTES) {
      validationError = `File size ${size} bytes exceeds the limit of ${MAX_FILE_SIZE_BYTES} bytes (${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB).`;
    }

    if (validationError) {
      console.warn(`Validation failed for ${objectPath} in bucket ${bucketId}: ${validationError}`);
      
      const supabaseAdminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_KEY')!
      );

      const { error: deleteError } = await supabaseAdminClient.storage
        .from(bucketId)
        .remove([objectPath]);

      if (deleteError) {
        console.error(`Failed to delete invalid file ${objectPath} from bucket ${bucketId}:`, deleteError.message);
        return new Response(JSON.stringify({ 
            error: `File validation failed and an subsequent error occurred while attempting to delete the invalid file.`, 
            validation_error: validationError,
            deletion_error: deleteError.message 
        }), { status: 500 });
      }
      
      console.log(`Successfully deleted invalid file ${objectPath} from bucket ${bucketId} due to validation error: ${validationError}`);
      return new Response(JSON.stringify({ error: `File rejected and deleted: ${validationError}` }), { status: 400 }); 
    }

    console.log(`File ${objectPath} (ID: ${objectId}) in bucket ${bucketId} validated successfully.`);
    return new Response(JSON.stringify({ success: true, message: 'File validated successfully.' }), { status: 200 });

  } catch (error) {
    console.error('Critical Error in Edge Function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
  }
});
