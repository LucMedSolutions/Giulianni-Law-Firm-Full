# Giulianni Law Firm - Integrated Automation System

This repository contains the integrated frontend and backend for the Giulianni Law Firm automation system, designed to streamline document management and legal case workflows through AI-powered analysis and automation.

## Features

-   User authentication and role-based access control (Clients, Staff, Admins).
-   Document upload and storage integrated with Supabase.
-   Case management functionalities.
-   Real-time notifications and messaging.
-   **AI-Powered Document Analysis:** Automated document summarization, information extraction, and task definition using Crew AI and Large Language Models (LLMs).
-   Task status tracking for AI processing.

## Tech Stack

-   **Frontend:**
    -   Next.js (v14+)
    -   React
    -   TypeScript
    -   Tailwind CSS
    -   Shadcn/ui component library
    -   Supabase (for BaaS features like Auth, Database, Storage)
    -   `pnpm` (preferred package manager)
-   **Backend:**
    -   FastAPI (Python web framework)
    -   Python (v3.9+)
    -   Crew AI (for AI agent orchestration)
    -   Langchain (for LLM interactions)
    -   Google Gemini (as the primary LLM provider)
    -   Uvicorn (ASGI server)

## Project Structure

-   `app/`: Contains the Next.js v14+ frontend application (App Router).
-   `backend/`: Contains the FastAPI backend application with Crew AI agents.
    -   `agents/`: Houses the Crew AI agent logic (`crew_runner.py`, `status.py`).
    -   `main.py`: FastAPI application entry point, API endpoint definitions.
    -   `requirements.txt`: Backend Python dependencies.
    -   `.env.example`: Example environment file for backend.
-   `frontend/`: Contains specific configurations for the Next.js frontend (e.g. `next.config.js`). Note: The main application code is in `app/`.
    -   `.env.local.example`: Example environment file for frontend.
-   `components/`: Shared UI components for the Next.js application.
-   `lib/`: Utility functions and Supabase client configurations.
-   `public/`: Static assets for the frontend.

## Prerequisites

-   Node.js (v18 or later recommended) and `pnpm` (or `npm`/`yarn`).
-   Python (v3.9 or later recommended) and `pip`.
-   Supabase account for database, authentication, and storage.
-   Google API Key for AI agent functionality using Gemini (see "API Key Configuration" section below).

## API Key Configuration

The backend requires a Google API key for interacting with the Gemini LLM. This key is managed via a JSON configuration file.

1.  **Create the Configuration File:**
    In the root directory of the project, create a directory named `config`. Inside this directory, create a file named `api-keys.json`.

2.  **Add API Key:**
    Open `config/api-keys.json` and add your Google API key in the following JSON format:

    ```json
    {
      "google": {
        "apiKey": "YOUR_GOOGLE_API_KEY_HERE"
      }
    }
    ```
    Replace `"YOUR_GOOGLE_API_KEY_HERE"` with your actual Google API key.

3.  **Security Note:**
    The `config/api-keys.json` file is included in the project's `.gitignore` file and **should not be committed to version control**. This is crucial to keep your API key secret.

    For local development, the backend will load the API key from this file. For deployed environments, you will typically set the `GOOGLE_API_KEY` environment variable directly on your hosting platform (see "Deployment" section). The application is configured to use the JSON file first, and fall back to the `GOOGLE_API_KEY` environment variable if the file or key within it is not found.

## Environment Variables

Proper configuration of environment variables is crucial for the application to run correctly. Example files (`.env.local.example` for Next.js frontend at the project root, and `backend/.env.example` for FastAPI backend) are provided. You should copy these to `.env.local` (for frontend) and `.env` (for backend) respectively, and fill in your actual credentials.

### Frontend (Next.js - `.env.local` at project root)

1.  At the project root, copy `.env.local.example` to a new file named `.env.local`.
    ```bash
    cp .env.local.example .env.local
    ```
2.  Edit `.env.local` and fill in the following variables:
    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL. (e.g., `https://your-project-ref.supabase.co`)
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project anonymous public key.
    *   `NEXT_PUBLIC_BACKEND_API_URL`: The full base URL for your FastAPI backend API.
        *   For local development, this is typically `http://localhost:8000`.
        *   For production, this will be your deployed backend URL.

    These `NEXT_PUBLIC_` variables are exposed to the browser. You can find your Supabase URL and anon key in your Supabase project settings (Project Settings > API).

    **Server-Side Next.js Variables (for API Routes):**
    Some Next.js API routes (e.g., `/api/get-signed-document-url`) might require server-side environment variables that are *not* prefixed with `NEXT_PUBLIC_`. These should be set in your deployment environment (e.g., Vercel environment variables) or in your local `.env.local` file for local development. They are not exposed to the browser.
    *   `SUPABASE_SERVICE_KEY`: Your Supabase project service role key. This is used by Next.js API routes that need to perform privileged Supabase operations (like the one generating signed URLs for private buckets if using a service client directly there).

### Backend (FastAPI - `backend/.env`)

1.  Navigate to the `backend/` directory.
2.  Copy `backend/.env.example` to a new file named `backend/.env`.
    ```bash
    cp backend/.env.example backend/.env
    ```
3.  Edit `backend/.env` and fill in the following variables:
    *   `SUPABASE_URL`: Your Supabase project URL (can be the same as `NEXT_PUBLIC_SUPABASE_URL`). Used by the backend for its Supabase client.
    *   `SUPABASE_SERVICE_KEY`: Your Supabase project service role key. **This key has admin privileges and must be kept secret.** It's used by the backend for privileged operations (e.g., `status.py`, `crew_runner.py`).
    *   `ALLOWED_ORIGINS`: A comma-separated list of frontend URLs allowed for CORS.
        *   Example: `http://localhost:3000,https://your-production-frontend.com`
    *   `GOOGLE_DEFAULT_MODEL`: (Optional, defaults to "gemini-pro" in code) The default Google Gemini model name to be used by Crew AI agents. You might still need to set `GOOGLE_API_KEY` as an environment variable in deployed environments if the `config/api-keys.json` file is not used there.
        *   Example: `gemini-pro`.
    *   `SUPABASE_GENERATED_DOCUMENTS_BUCKET`: (Optional, defaults to "generated_documents" in code) The Supabase Storage bucket name where AI-generated documents are stored.
        *   Example: `generated_documents`
    *   `GOOGLE_API_KEY`: (Optional Fallback/Deployment) While local development primarily uses `config/api-keys.json`, this environment variable can serve as a fallback or for deployed environments where managing JSON files is less convenient. If `config/api-keys.json` is not found or doesn't contain the key, the system will check for this environment variable.

    The `PYTHONPATH` variable mentioned previously in some examples is optional and depends on specific setup needs.

## Supabase Storage Security and Validation

To enhance security and ensure only allowed file types and sizes are uploaded, server-side validation should be implemented at the Supabase Storage layer. The 'documents' bucket **must be set to private**.

### Recommended Approach: Edge Function

The most flexible and robust method is to use a Supabase Edge Function triggered on new object creation in the 'documents' bucket.

**Conceptual Edge Function (`validate-upload/index.ts`):**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

serve(async (req) => {
  const payload = await req.json();
  const record = payload.record; // For 'storage.object.created' trigger

  if (!record || !record.metadata) {
    console.warn('No record or metadata in payload:', payload);
    return new Response(JSON.stringify({ error: 'Payload missing record or metadata' }), { status: 400 });
  }

  const { size, mimetype, bucket_id, name: objectPath } = record.metadata;

  if (bucket_id !== 'documents') {
    return new Response(JSON.stringify({ message: 'Not in documents bucket, skipping.' }), { status: 200 });
  }

  let validationError = null;

  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    validationError = `Invalid file type: ${mimetype}.`;
  } else if (size > MAX_FILE_SIZE_BYTES) {
    validationError = `File size ${size} exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes.`;
  }

  if (validationError) {
    console.warn(`Validation failed for ${objectPath}: ${validationError}`);
    // Delete the invalid file
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_KEY')!
    );
    const { error: deleteError } = await supabaseAdmin.storage
      .from(bucket_id)
      .remove([objectPath]);

    if (deleteError) {
      console.error(`Failed to delete invalid file ${objectPath}:`, deleteError);
      return new Response(JSON.stringify({ error: `Validation failed and could not delete file: ${deleteError.message}` }), { status: 500 });
    }
    // Optionally, log this event to an audit table or send a notification.
    return new Response(JSON.stringify({ error: `File rejected: ${validationError}` }), { status: 403 }); // 403 Forbidden or another suitable code
  }

  console.log(`File ${objectPath} validated successfully.`);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```
This Edge Function would be deployed to Supabase and configured to trigger on object creation in the 'documents' bucket. It requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as environment variables.

### Alternative: Storage RLS Policies (Potential Limitations)

Row Level Security (RLS) policies on the `storage.objects` table can also be used, but direct access to reliable `mimetype` and `size` from `NEW.metadata` during an `INSERT` `WITH CHECK` clause can be tricky and might have limitations. The metadata might be fully populated only after the initial insert.

**Conceptual RLS Policy (Verify carefully before production):**
```sql
-- Ensure the bucket is private and RLS is enabled on storage.objects
-- This policy attempts to validate file type and size on upload to the 'documents' bucket.
-- WARNING: The reliability of NEW.metadata fields at the time of INSERT check needs thorough testing.
-- An Edge Function (see above) is generally more robust for this.

CREATE POLICY "Restrict file types and size for documents bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (NEW.metadata ->> 'size')::bigint <= 10485760 AND -- 10MB (10 * 1024 * 1024)
  (NEW.metadata ->> 'mimetype') IN (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  )
);

-- Remember to also have policies for SELECT, UPDATE, DELETE as needed,
-- restricting access based on user roles and ownership.
-- Example: Allow users to select their own files or files related to their cases.
```
Users should test this RLS policy thoroughly. If it doesn't work as expected (e.g., blocks valid files or allows invalid ones due to metadata timing), the Edge Function approach is recommended.

### RLS Policies for `documents` (Metadata) Table

It's crucial to implement Row Level Security (RLS) policies on the `documents` table (which stores metadata about files) to ensure users can only access records they are authorized to see. This complements storage bucket security.

**Conceptual Policies for `documents` Table:**

*   **Clients can only see their own documents:**
    ```sql
    -- Assuming 'documents' table has a 'client_id' or 'user_id' column linked to the uploader/owner.
    -- Or, access is determined via linked 'cases' table and 'case_assignments'.
    -- Example if 'uploaded_by' stores the user's ID:
    CREATE POLICY "Clients can view their own document records"
    ON documents FOR SELECT
    TO authenticated
    USING (auth.uid() = uploaded_by);

    CREATE POLICY "Clients can insert document records for themselves"
    ON documents FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);
    ```

*   **Staff access based on case assignments:**
    ```sql
    -- This is more complex and depends on your schema (e.g., a 'case_assignments' table).
    -- Conceptual: Allow staff to see document records for cases they are assigned to.
    CREATE POLICY "Staff can view document records for assigned cases"
    ON documents FOR SELECT
    TO authenticated -- Should ideally be restricted to 'staff' role if possible via a function
    USING (
      EXISTS (
        SELECT 1 FROM case_assignments ca
        WHERE ca.case_id = documents.case_id AND ca.user_id = auth.uid()
      )
      -- Add OR condition if staff role has different levels of access based on user's role attribute
      -- OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin' -- If admins can see all
    );
    ```
    Similar policies would be needed for `INSERT`, `UPDATE`, `DELETE` on the `documents` table, tailored to roles and ownership. For instance, only specific staff roles or the uploader might be allowed to update/delete.

*   **Admin full access:** Often granted by bypassing RLS (if Supabase client uses service key) or a permissive policy for an 'admin' role.

**Key Considerations for `documents` Table RLS:**
*   These policies prevent users from even listing metadata (like file paths or bucket names) for documents they shouldn't access. This is a critical step before generating signed URLs, as a user should only be able to request a signed URL for a document they are authorized to access the metadata of.
*   Ensure `UPDATE` and `DELETE` policies are also strictly defined to prevent unauthorized modification or deletion of document records.

### Resetting Your Environment (For Testing)

If you need to reset your environment variable setup to start fresh (e.g., for testing the setup process):

1.  Navigate to the project root directory.
2.  Run the `scripts/reset_env.sh` script:
    ```bash
    bash scripts/reset_env.sh 
    ```
    Or, make it executable first (`chmod +x scripts/reset_env.sh`) and then run `./scripts/reset_env.sh`.

    **Caution:** This script will remove `frontend/.env.local` and `backend/.env`. It will ask for confirmation before deleting. This is useful for ensuring you are testing the setup from a clean state based on the `.example` files.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repository-directory-name>
```

### 2. Frontend Setup

Navigate to the `frontend/` directory:
```bash
cd frontend 
```
(If you are at the root of the project. The main Next.js `package.json` and `pnpm-lock.yaml` are in the root, but frontend-specific config like `.env.local` belongs here as per standard Next.js practice for environment variables, even if the `app` directory is at the root.)
*Correction based on provided structure: The primary `package.json` and `pnpm-lock.yaml` are at the project root. The `frontend` directory seems to be for specific config like `next.config.js` and potentially `.env.local` if not using root.*

**Revised Frontend Setup (assuming pnpm and project root for commands):**

```bash
# Ensure you are in the project root directory
pnpm install
```
If you prefer `npm` or `yarn`:
```bash
# npm install
# or
# yarn install
```
After installing dependencies, ensure your `frontend/.env.local` file is configured as described in the "Environment Variables" section.

### 3. Backend Setup

Navigate to the `backend/` directory:
```bash
cd backend
```

Create and activate a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```
Ensure your `backend/.env` file is configured as described in the "Environment Variables" section.

## Running the Application Locally

### 1. Start the Backend Server

Navigate to the `backend/` directory and ensure your virtual environment is activated.
Run the FastAPI application using Uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be accessible at `http://localhost:8000`.

Alternatively, you can use the `scripts/dev.sh` script to start both servers concurrently (ensure it's executable: `chmod +x scripts/dev.sh`).

### 2. Start the Frontend Development Server

Navigate to the project root directory (where `package.json` for Next.js is located).
Run the Next.js development server:
```bash
pnpm dev
# or
# npm run dev
# or
# yarn dev
```
The frontend application will typically be accessible at `http://localhost:3000`. Check your terminal output for the exact URL.

## AI Document Processing Workflow

The core AI-driven document analysis follows these steps:

1.  **Document Upload:** The user uploads a document (e.g., PDF, DOCX) and can optionally provide a specific query or notes related to the document through the frontend application.
2.  **Storage:** The frontend uploads the selected file directly to Supabase Storage, receiving a public URL for the stored document.
3.  **Backend API Call:** The frontend then makes a POST request to the `/parse-document/` endpoint on the backend, providing the `file_url`, `filename`, and the `user_query`.
4.  **AI Crew Processing:**
    *   The backend's `LawFirmCrewRunner` initiates a new task.
    *   The `DocumentParserAgent` (using an LLM like OpenAI) processes the document. If raw text was passed from `document_info` (not currently implemented in this flow but a future possibility), it would use that. Otherwise, it's designed to summarize based on the content (currently uses mock text if only URL is available, as direct URL fetching/parsing by the agent is a TODO). Its goal is to output a JSON object with `extracted_text` and `summary`.
    *   The `TaskDefinitionAgent` takes the output from the `DocumentParserAgent` and the initial `user_query`. It uses an LLM to define 2-3 specific, actionable follow-up tasks, outputting them as a JSON list of task definitions.
5.  **Task ID Return:** The backend's `/parse-document/` endpoint returns a `task_id` to the frontend as soon as the crew is initiated (or completes, as it's currently synchronous).
6.  **Status Polling:** The frontend uses the received `task_id` to navigate to a task status page (`/client-dashboard/tasks/[task_id]`). This page polls the backend's `/agent-status/?task_id={task_id}` endpoint every few seconds.
7.  **Display Results:** The status page displays real-time status updates. Once the AI crew processing is 'completed' or encounters an 'error', the polling stops, and the final results (e.g., the list of defined tasks from `TaskDefinitionAgent`, or error details) are displayed to the user.

## Key API Endpoints (Backend - http://localhost:8000)

-   **`POST /parse-document/`**:
    -   Accepts a JSON body: `{"file_url": "...", "filename": "...", "user_query": "..."}`.
    -   Purpose: Initiates the AI document processing workflow using Crew AI.
    -   Returns: A `task_id` and the initial status of the processing job.
-   **`GET /agent-status/?task_id={task_id}`**:
    -   Accepts a `task_id` as a query parameter.
    -   Purpose: Retrieves the current status, messages, and results (if completed) of an AI processing task.
-   **`POST /generate-task/` (Potentially Deprecated)**:
    -   Accepts a JSON body (e.g., `{"document_info": {...}, "user_query": "..."}`).
    -   Purpose: Older endpoint for task generation. The primary workflow now uses agents within the `/parse-document/` flow.
    -   Current status: Calls the `generate_legal_tasks` function from `backend/agents/task_generator.py`.

### Testing the AI Workflow

To test the end-to-end AI document processing workflow:

1.  **Servers Running:** Ensure both the backend (`uvicorn main:app --reload --port 8000` in `backend/`) and frontend (`pnpm dev` in the project root) servers are running.
2.  **API Key and Environment Variables:** Verify that:
    *   `config/api-keys.json` is created and contains your Google API key as described in the "API Key Configuration" section.
    *   `frontend/.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` correctly set.
    *   `backend/.env` is configured (though `GOOGLE_API_KEY` in this file is now a fallback).
3.  **Login:** Access the frontend application (usually `http://localhost:3000`) and log in.
4.  **Navigate:** Go to the document upload page (e.g., Client Dashboard > Documents > Upload).
5.  **Upload:** Select a test document (e.g., a text file, PDF) and optionally add a user query/note in the provided field. Click "Upload Document".
6.  **Backend Logs:** Observe the terminal running the backend server. You should see logs indicating the start of AI processing by `LawFirmCrewRunner`. If a `GOOGLE_API_KEY` is configured, you'll see logs from CrewAI about agent execution using Gemini. If not, mock processing logs will appear.
7.  **Task Status Page:** You should be redirected to the task status page (e.g., `/client-dashboard/tasks/[task_id]`).
8.  **Observe Status:** The page will poll for status updates. You should see the status change (e.g., from 'pending' to 'in_progress', then to 'completed' or 'error').
9.  **View Results:** Upon 'completed' status, the AI-generated results (such as a document summary and a list of defined tasks) will be displayed on the page. If 'error', error details will be shown.

## Deployment

**General Notes:**
- The frontend and backend are designed to run independently and can be deployed to separate services/platforms.
- For future scalability and more complex deployments, consider containerizing the backend (and potentially frontend) using Docker. A `Dockerfile` for the backend would define its Python environment, copy application code, and specify the command to run Uvicorn. (No `Dockerfile` is provided in this iteration).

**Dependency Management:**
- Backend dependencies in `backend/requirements.txt` are pinned for production stability. Review and update these versions periodically.
- Frontend dependencies in the root `package.json` (for the Next.js app in `app/`) use semantic versioning (e.g., `^1.2.3`). The specific versions are locked by `pnpm-lock.yaml` (or `package-lock.json`/`yarn.lock`). Ensure your lock file is committed and used during deployment.

### Frontend (e.g., Vercel)

-   The Next.js frontend (App Router) is well-suited for deployment on platforms like Vercel.
-   Ensure you set the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables in your Vercel project settings.
-   Connect your Git repository to Vercel for CI/CD (Continuous Integration/Continuous Deployment). Vercel will typically build and deploy your frontend automatically on pushes to the main branch.

### Backend (e.g., Railway, AWS)

-   The FastAPI backend can be deployed to various platforms supporting Python applications, such as Railway, AWS (Elastic Beanstalk, ECS, Lambda with Mangum), Google Cloud Run, Heroku, etc.
-   You will need to set the `GOOGLE_API_KEY` (and `GOOGLE_DEFAULT_MODEL` if you wish to override the default) on your chosen deployment platform.
-   Ensure your deployment process installs dependencies from `backend/requirements.txt`. This is typically done via a `pip install -r requirements.txt` command during the build process.
-   Consider containerizing the backend with Docker for easier deployment, scalability, and environment consistency. (A `Dockerfile` is not yet provided but would be a good addition for production deployments).
-   You will need an ASGI server like Uvicorn (with Gunicorn as a process manager in production) to run the FastAPI application. The command would be similar to `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`.

## Deployment to Vercel

This project is configured for deployment to Vercel, which can host both the Next.js frontend and the FastAPI backend.

### Prerequisites

*   A Vercel account.
*   Vercel CLI (optional, as deployments can be managed via Git integration).

### Setup and Deployment Steps

1.  **Connect Git Repository:**
    *   Push your project to a Git repository (e.g., GitHub, GitLab, Bitbucket).
    *   Connect this repository to your Vercel account. Vercel will usually automatically detect it as a Next.js project.

2.  **`vercel.json` Configuration:**
    *   A `vercel.json` file is included in the project root. This file tells Vercel how to build the Next.js frontend (outputting to the `.next` directory) and the Python backend (`backend/main.py`). It also configures routing:
        *   Requests to `/api/*` are routed to the FastAPI backend.
        *   All other requests are routed to the Next.js frontend.

3.  **Configure Environment Variables:**
    In your Vercel project settings (under "Settings" > "Environment Variables"), add the following:
    *   `GOOGLE_API_KEY`: Your Google API key for Gemini LLM. This is necessary because the `config/api-keys.json` file is not committed to version control.
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_SERVICE_KEY`: Your Supabase project service role key.
    *   `ALLOWED_ORIGINS`: The production URL of your Vercel frontend (e.g., `https://your-project-name.vercel.app`). You can add other domains if needed, separated by commas.
    *   `GOOGLE_DEFAULT_MODEL`: (Optional) If you want to use a specific Gemini model different from the default (`gemini-pro`), set it here.
    *   `PYTHONPATH`: Set this to `backend` to ensure Python can correctly import modules within the `backend` directory on Vercel's build environment. Vercel might require this for the Python runtime to find your backend modules. (e.g., Value: `backend`)
    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (same as `SUPABASE_URL`).
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project anonymous public key.
    *   `NEXT_PUBLIC_BACKEND_API_URL`: This should be the URL where your Vercel-deployed backend will be available. Since both frontend and backend are on the same Vercel deployment, this will be your main Vercel project URL (e.g., `https://your-project-name.vercel.app`). Vercel handles the routing to `/api/*` internally.

4.  **Trigger Deployment:**
    *   Commit and push your changes (including `vercel.json`) to your connected Git repository.
    *   Vercel should automatically start a new deployment. You can also manually trigger deployments from the Vercel dashboard.

5.  **Check Build Logs:**
    *   Monitor the build and deployment logs in your Vercel dashboard for any errors. Address them as needed. Common issues can relate to missing dependencies, incorrect environment variable settings, or build command failures.

### Notes
*   The `@vercel/python` builder installs dependencies from `backend/requirements.txt` for the FastAPI application.
*   The `@vercel/next` builder handles the Next.js frontend build.

## Contributing

Details on contributing to this project will be added here.

### CI/CD (Continuous Integration/Continuous Deployment)

Automating testing and deployment can greatly improve the development workflow. Here's a basic CI/CD setup suggestion using GitHub Actions:

**Backend (FastAPI):**
*   **Trigger:** On push to `main` branch or pull request to `main`.
*   **Jobs:**
    1.  **Lint & Test:**
        *   Set up Python environment.
        *   Install dependencies from `backend/requirements.txt`.
        *   Run a linter (e.g., Flake8, Black).
        *   Run backend unit/integration tests (if any are added in the future).
    2.  **Build Docker Image (Optional, if containerizing):**
        *   Build a Docker image using a `Dockerfile` (if created).
        *   Push the image to a container registry (e.g., Docker Hub, GitHub Container Registry, AWS ECR).
    3.  **Deploy:**
        *   Deploy to your chosen platform (e.g., Railway, AWS Elastic Beanstalk, Google Cloud Run). This often involves using platform-specific CLI tools or GitHub Actions integrations. Securely store API keys and other secrets in GitHub Actions secrets.

**Frontend (Next.js):**
*   **Trigger:** On push to `main` branch or pull request to `main`.
*   **Jobs:**
    1.  **Lint & Test:**
        *   Set up Node.js environment (use pnpm).
        *   Install dependencies (`pnpm install`).
        *   Run a linter (e.g., ESLint).
        *   Run unit/integration tests (e.g., with Jest, Playwright if added).
    2.  **Build:**
        *   Run `pnpm build`.
    3.  **Deploy (e.g., to Vercel):**
        *   Vercel has excellent integration with GitHub. Connecting your repository to a Vercel project usually handles CI/CD automatically for the frontend. Ensure environment variables are set in Vercel project settings.

This is a general outline. Specific implementation details will vary based on your chosen hosting platforms and testing frameworks.
```
