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

The function's behavior is primarily configured through environment variables, which can be set in your Supabase project dashboard under `Project Settings` > `Functions`, then selecting the `validate-upload` function and navigating to its "Environment variables" or "Secrets" section.

### Environment Variables for Validation Logic

These variables control the validation parameters:

*   **`VALIDATE_UPLOAD_ALLOWED_MIME_TYPES`**
    *   **Description:** A comma-separated string of allowed MIME types for uploaded files.
    *   **Example:** `application/pdf,image/png,image/jpeg,text/plain`
    *   **Default:** If not set, a predefined list is used:
        ```
        application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png, text/plain, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv
        ```
    *   **Notes:** Ensure MIME types are standard and correctly formatted. Leading/trailing whitespace will be trimmed. If this variable is set to an empty string or only contains delimiters (like `, , ,`), it might result in no MIME types being allowed, effectively blocking all uploads based on type.

*   **`VALIDATE_UPLOAD_MAX_FILE_SIZE_MB`**
    *   **Description:** The maximum allowed file size in Megabytes (MB). The function will convert this value to bytes.
    *   **Example:** `20` (for 20MB)
    *   **Default:** `15` (for 15MB)
    *   **Notes:** Only positive integer values are accepted. If an invalid value (e.g., non-numeric, zero, or negative) is provided, the function will revert to the default size.

*   **`VALIDATE_UPLOAD_TARGET_BUCKETS`**
    *   **Description:** A comma-separated string of Supabase Storage bucket names that this function should validate. Files uploaded to other buckets will be ignored by this validation function.
    *   **Example:** `documents,proof_of_identity,generated_case_files`
    *   **Default:** `documents`
    *   **Notes:** Ensure bucket names match exactly those in your Supabase Storage. Leading/trailing whitespace will be trimmed. If this variable is set but results in an empty list (e.g., an empty string or only delimiters), no buckets will be targeted for validation.

### Essential Secrets for Supabase Admin Client

The Edge Function also requires the following secrets to be set to allow it to initialize a Supabase admin client. This client is used for privileged actions like deleting invalid files from storage. These are typically set in the "Secrets" section of your function's settings in the Supabase dashboard.

*   **`SUPABASE_URL`**: Your project's Supabase URL (e.g., `https://<your-project-ref>.supabase.co`). This is often available as `NEXT_PUBLIC_SUPABASE_URL` in frontend applications.
*   **`SUPABASE_SERVICE_KEY`**: Your project's `service_role` key. This key has admin privileges and must be kept secret and secure.

## Prerequisites

1.  **Supabase Project:** You need an active Supabase project.
2.  **Supabase CLI:** Ensure you have the Supabase CLI installed and configured for your project.
3.  **Private Storage Buckets:** This function is primarily intended for private buckets where you want to enforce strict server-side validation. For public buckets, client-side validation might be sufficient, but server-side can still be a good defense. The buckets listed in `VALIDATE_UPLOAD_TARGET_BUCKETS` should generally be configured as **private**.

## Deployment

1.  **Write/Customize the Function Code:** Ensure the code in `supabase/functions/validate-upload/index.ts` is as provided or customized to your needs.
2.  **Set Environment Variables & Secrets:** Configure the environment variables and secrets as described in the "Configuration" section within your Supabase project dashboard.
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
        *   Add an `Authorization` header: `Bearer <your_webhook_secret>`.
            *   **Recommended:** Use your project's `service_role` key as the `<your_webhook_secret>`. This is the most secure option, ensuring that only Supabase (via its trusted webhook system) can trigger your Edge Function.
            *   **Alternative:** For enhanced security, you can generate a unique, strong secret token (a long random string) specifically for this webhook. Store this secret securely and use it as the `Bearer` token. Your Edge Function code would then need to be modified to verify this token (this verification is not part of the default `validate-upload` function but is a recommended customization for production).
            *   **Less Secure Fallback (Use with Caution):** While you *can* use your project's `anon` key, this is generally not recommended for webhook authentication if the Edge Function URL could be discovered, as the `anon` key is public. Using it might be acceptable only in tightly controlled environments or for less critical functions where the risk is understood. The `validate-upload` function itself uses its own `SUPABASE_SERVICE_KEY` secret (configured as an environment variable for the Edge Function) for performing privileged actions like file deletion, regardless of the webhook authorization method.

8.  Click **Create webhook**.

Now, whenever a new file is uploaded to any of your Supabase Storage buckets, this webhook will fire and send the new object's record to your `validate-upload` Edge Function. The function will then perform validation if the object is in one of the `TARGET_BUCKETS`.

## How It Works

1.  A new file is uploaded to a Supabase Storage bucket.
2.  If the upload is to any bucket, the `INSERT` event on `storage.objects` triggers the configured Database Webhook.
3.  The webhook sends a POST request with the new object's record (including metadata like `bucket_id`, `name`, `metadata.mimetype`, `metadata.size`) to the `validate-upload` Edge Function.
4.  The Edge Function checks if the `bucket_id` is in its `TARGET_BUCKETS` list (configured by `VALIDATE_UPLOAD_TARGET_BUCKETS`).
5.  If targeted, it validates the file's `mimetype` and `size` against `ALLOWED_MIME_TYPES` (from `VALIDATE_UPLOAD_ALLOWED_MIME_TYPES`) and `MAX_FILE_SIZE_BYTES` (from `VALIDATE_UPLOAD_MAX_FILE_SIZE_MB`).
6.  If validation fails:
    *   The function logs the validation error.
    *   It initializes a Supabase admin client using the `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (from its environment secrets).
    *   It attempts to delete the invalid file from storage using `supabaseAdmin.storage.from(bucketId).remove([objectPath])`.
    *   It returns a response indicating the failure and deletion (e.g., HTTP 400).
7.  If validation passes, or if the bucket is not targeted, the function returns a success response (HTTP 200 or 204).

This server-side validation helps maintain the integrity and security of your file storage.
