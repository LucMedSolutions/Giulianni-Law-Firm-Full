# Supabase Edge Function: `validate-upload`

## Purpose

The `validate-upload` Edge Function is designed to automatically validate new files uploaded to specified Supabase Storage buckets. It checks files against a predefined list of allowed MIME types and a maximum file size. If a file fails validation, the function attempts to delete it from the storage bucket.

This provides server-side validation, acting as a safeguard even if client-side checks are bypassed or fail.

## Features

-   **MIME Type Validation:** Ensures uploaded files match a list of allowed content types.
-   **File Size Validation:** Enforces a maximum file size limit.
-   **Automatic Deletion:** Removes files that do not meet the validation criteria.
-   **Targeted Buckets:** Can be configured to only validate files in specific storage buckets.
-   **Logging:** Provides console logs for monitoring its operations.

## Configuration

The function's behavior can be configured by modifying these constants at the top of `supabase/functions/validate-upload/index.ts`:

-   `ALLOWED_MIME_TYPES`: An array of strings representing permitted MIME types.
    -   Default: `['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']`
-   `MAX_FILE_SIZE_BYTES`: Maximum allowed file size in bytes.
    -   Default: `15 * 1024 * 1024` (15MB)
-   `TARGET_BUCKETS`: An array of bucket names (strings) that this function should validate. Files uploaded to other buckets will be ignored.
    -   Default: `['documents']` (You might want to add `'generated_documents'` or other relevant private buckets)

## Prerequisites

1.  **Supabase Project:** You need an active Supabase project.
2.  **Supabase CLI:** Ensure you have the Supabase CLI installed and configured for your project.
3.  **Private Storage Buckets:** This function is primarily intended for private buckets where you want to enforce strict server-side validation. For public buckets, client-side validation might be sufficient, but server-side can still be a good defense. The `documents` bucket (and any other `TARGET_BUCKETS`) should be configured as **private**.

## Deployment

1.  **Write the Function Code:** Ensure the code in `supabase/functions/validate-upload/index.ts` is as provided or customized to your needs.
2.  **Set Environment Variables (Secrets):**
    This Edge Function requires the following secrets to be set in your Supabase project dashboard to allow it to initialize a Supabase admin client for deleting invalid files:
    *   Go to your Supabase Project Dashboard.
    *   Navigate to `Project Settings` > `Functions`.
    *   Select the `validate-upload` function (it will appear after first deployment attempt or can be pre-configured).
    *   Under the "Secrets" section, add the following:
        *   `SUPABASE_URL`: Your project's Supabase URL (e.g., `https://<your-project-ref>.supabase.co`). This is the same as `NEXT_PUBLIC_SUPABASE_URL`.
        *   `SUPABASE_SERVICE_KEY`: Your project's `service_role` key. This key has admin privileges and should be kept secret.
3.  **Deploy the Function:**
    Open your terminal, navigate to your project's root directory (where your `supabase` folder is), and run:
    ```bash
    supabase functions deploy validate-upload --project-ref <your-project-ref>
    ```
    Replace `<your-project-ref>` with your actual Supabase project reference ID.
    If you encounter issues related to Deno (e.g. import map), ensure your Supabase CLI is up to date and your Deno environment (if managing it locally for testing) is compatible. Usually, the Supabase CLI handles the Deno environment for Edge Functions during deployment.

## Trigger Setup (Database Webhook)

The `validate-upload` Edge Function is designed to be triggered by a Supabase Database Webhook when new objects are inserted into the `storage.objects` table.

**Follow these steps to set up the webhook in your Supabase Dashboard:**

1.  Navigate to your Supabase project dashboard.
2.  Go to **Database** > **Webhooks**.
3.  Click on **Create a new webhook**.
4.  **Name your webhook:** For example, `Validate New Storage Object` or `Trigger Validate Upload Function`.
5.  **Table:** Select `objects` from the `storage` schema.
6.  **Events:** Check **INSERT**.
7.  **HTTP Request:**
    *   **Method:** `POST`
    *   **URL:** Enter the URL of your deployed `validate-upload` Edge Function. This URL will look like:
        `https://<your-project-ref>.functions.supabase.co/validate-upload`
        (Replace `<your-project-ref>` with your actual Supabase project reference ID).
    *   **HTTP Headers:**
        *   Add a header for `Content-Type` with value `application/json`.
        *   Add an `Authorization` header: `Bearer <your_anon_key_or_service_key>`.
            *   You can use your project's `anon` key if your Edge Function does not have specific authorization checks beyond this.
            *   If you want to secure the Edge Function endpoint itself (not implemented in the provided code but possible), you'd use a secret token or the `service_role` key here and verify it in the function. For simplicity, using the `anon` key is often sufficient as the function itself uses the `service_role` key (from secrets) for privileged actions like file deletion.
            *   **Using `service_role` key for webhook Authorization**: This is a secure option if you want to ensure only Supabase itself can trigger the function. The Edge Function itself doesn't currently validate this incoming bearer token, but it's good practice to send it.

8.  Click **Create webhook**.

Now, whenever a new file is uploaded to any of your Supabase Storage buckets, this webhook will fire and send the new object's record to your `validate-upload` Edge Function. The function will then perform validation if the object is in one of the `TARGET_BUCKETS`.

## How It Works

1.  A new file is uploaded to a Supabase Storage bucket.
2.  If the upload is to any bucket, the `INSERT` event on `storage.objects` triggers the configured Database Webhook.
3.  The webhook sends a POST request with the new object's record (including metadata like `bucket_id`, `name`, `metadata.mimetype`, `metadata.size`) to the `validate-upload` Edge Function.
4.  The Edge Function checks if the `bucket_id` is in its `TARGET_BUCKETS` list.
5.  If targeted, it validates the file's `mimetype` and `size` against `ALLOWED_MIME_TYPES` and `MAX_FILE_SIZE_BYTES`.
6.  If validation fails:
    *   The function logs the validation error.
    *   It initializes a Supabase admin client using the `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (from its environment secrets).
    *   It attempts to delete the invalid file from storage using `supabaseAdmin.storage.from(bucketId).remove([objectPath])`.
    *   It returns a response indicating the failure and deletion (e.g., HTTP 400).
7.  If validation passes, or if the bucket is not targeted, the function returns a success response (HTTP 200).

This server-side validation helps maintain the integrity and security of your file storage.
