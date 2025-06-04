# API Configuration and Environment Variable Guide

This document provides a comprehensive guide to configuring the necessary API keys, URLs, and other environment variables for this project.

**IMPORTANT SECURITY NOTICE:**
- **DO NOT commit actual secret keys or sensitive credentials to this file or any other file in the Git repository.**
- Secret keys should be stored securely. For Vercel deployment, use the Vercel project's Environment Variables settings. For local development, use `.env.local` and `backend/.env` files, which are included in `.gitignore` and should never be committed.

---

## I. Vercel Deployment Environment Variables

Set these variables in your Vercel project settings: **Dashboard > [Your Project] > Settings > Environment Variables**.

### A. Supabase Configuration

1.  **`NEXT_PUBLIC_SUPABASE_URL`**
    *   **Description:** Your Supabase project's unique URL.
    *   **Where to find:** Supabase Dashboard > Your Project > Settings (gear icon) > API > Project URL.
    *   **Example Value:** `https://your-project-ref.supabase.co`
    *   **Note:** `NEXT_PUBLIC_` prefix makes it available to browser-side Next.js code.

2.  **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
    *   **Description:** Your Supabase project's anonymous public key.
    *   **Where to find:** Supabase Dashboard > Your Project > Settings (gear icon) > API > Project API Keys > `anon` `public` key.
    *   **Note:** `NEXT_PUBLIC_` prefix makes it available to browser-side Next.js code.

3.  **`SUPABASE_URL`**
    *   **Description:** Your Supabase project's unique URL (used by backend and Next.js server-side).
    *   **Value:** Same as `NEXT_PUBLIC_SUPABASE_URL`.
    *   **Where to find:** Supabase Dashboard > Your Project > Settings (gear icon) > API > Project URL.

4.  **`SUPABASE_SERVICE_KEY`**
    *   **Description:** Your Supabase project's service role key. This key has admin privileges.
    *   **Where to find:** Supabase Dashboard > Your Project > Settings (gear icon) > API > Project API Keys > `service_role` `secret` key.
    *   **SECURITY:** Highly sensitive. Keep it secret. Do NOT prefix with `NEXT_PUBLIC_`.

### B. Google AI (Gemini) Configuration

5.  **`GOOGLE_API_KEY`**
    *   **Description:** Your Google API key for the Gemini LLM.
    *   **Where to find:** Google Cloud Console > Your Project > APIs & Services > Credentials. Ensure the Generative Language API or Vertex AI API is enabled for this key and your project.
    *   **SECURITY:** Sensitive.

6.  **`GOOGLE_DEFAULT_MODEL`** (Optional)
    *   **Description:** Specifies the Google Gemini model if you want to override the default in the code (e.g., "gemini-pro").
    *   **Example Value:** `gemini-1.5-pro-latest`

### C. Application & Vercel Configuration

7.  **`NEXT_PUBLIC_BACKEND_API_URL`**
    *   **Description:** The full base URL of your deployed FastAPI backend.
    *   **Value for Vercel:** Your main Vercel project URL (e.g., `https://your-project-name.vercel.app`). Vercel routes `/api/*` requests from this URL to your Python backend.
    *   **Where to find:** This is the URL Vercel assigns to your project upon deployment.
    *   **Note:** `NEXT_PUBLIC_` prefix makes it available to browser-side Next.js code.

8.  **`ALLOWED_ORIGINS`**
    *   **Description:** Comma-separated list of frontend URLs allowed for CORS by the FastAPI backend.
    *   **Value for Vercel:** Your main Vercel project URL (e.g., `https://your-project-name.vercel.app`). You might also include `http://localhost:3000` for local testing against the deployed backend.
    *   **Example Value:** `https://your-project-name.vercel.app,http://localhost:3000`

9.  **`PYTHONPATH`**
    *   **Description:** Required by Vercel's Python runtime to correctly import modules from the `backend` directory.
    *   **Value:** `backend`

### D. Optional Backend Configuration

10. **`SUPABASE_GENERATED_DOCUMENTS_BUCKET`** (Optional)
    *   **Description:** Supabase Storage bucket name for AI-generated documents, if different from the code default ("generated_documents").
    *   **Example Value:** `my_ai_docs_bucket`

---

## II. Local Development Environment Variables

For local development, create the following files (if they don't exist) and add the corresponding variables. These files are listed in `.gitignore` and **should not be committed to Git.**

### A. Frontend (Next.js - Root Directory)

*   Create/Use file: `.env.local` (at the project root)
*   Copy relevant variables from the Vercel list above:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    *   `NEXT_PUBLIC_BACKEND_API_URL` (For local development, this should point to your local backend, typically `http://localhost:8000`)
    *   `SUPABASE_SERVICE_KEY` (If any Next.js API routes need it directly)

### B. Backend (FastAPI - `backend/` Directory)

*   Create/Use file: `backend/.env`
*   Copy relevant variables from the Vercel list above:
    *   `SUPABASE_URL`
    *   `SUPABASE_SERVICE_KEY`
    *   `GOOGLE_API_KEY`
    *   `ALLOWED_ORIGINS` (e.g., `http://localhost:3000` for your local frontend)
    *   `GOOGLE_DEFAULT_MODEL` (Optional)
    *   `SUPABASE_GENERATED_DOCUMENTS_BUCKET` (Optional)

---

## III. Supabase Edge Function (`validate-upload`) Environment Variables

The `validate-upload` Edge Function (located in `supabase/functions/validate-upload/`) needs its own environment variables set directly within the Supabase platform.

**Where to set:** Supabase Dashboard > Your Project > Edge Functions > Select `validate-upload` function > Settings/Configuration.

1.  **`SUPABASE_URL`**
    *   **Value:** Your Supabase project URL.
2.  **`SUPABASE_SERVICE_KEY`**
    *   **Value:** Your Supabase project service role key.
    *   **SECURITY:** Needed by the function to delete invalid files.

---

Remember to replace placeholder values (like `your-project-ref`, `your-project-name.vercel.app`) with your actual project details.
