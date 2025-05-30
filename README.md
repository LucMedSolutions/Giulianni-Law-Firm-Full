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
    -   OpenAI (as the primary LLM provider, with Gemini as an optional future integration)
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
-   OpenAI API key for AI agent functionality.

## Environment Variables

Proper configuration of environment variables is crucial for the application to run correctly. Example files are provided, which you should copy and fill with your actual credentials.

### Frontend (`frontend/.env.local`)

1.  Navigate to the `frontend/` directory.
2.  Copy `frontend/.env.local.example` to a new file named `frontend/.env.local`.
    ```bash
    cp frontend/.env.local.example frontend/.env.local
    ```
3.  Edit `frontend/.env.local` and fill in the following variables:
    -   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project anon key.

    These are public keys and are safe to be exposed to the browser. You can find these in your Supabase project settings under Project Settings > API.

### Backend (`backend/.env`)

1.  Navigate to the `backend/` directory.
2.  Copy `backend/.env.example` to a new file named `backend/.env`.
    ```bash
    cp backend/.env.example backend/.env
    ```
3.  Edit `backend/.env` and fill in the following variables:
    -   `OPENAI_API_KEY`: Your OpenAI API key. This is required for the AI agents to function. You can obtain an API key from [OpenAI Platform](https://platform.openai.com/signup).
    -   `GEMINI_API_KEY` (Optional): Your Google Gemini API key if you plan to integrate or switch to Gemini models.
    -   The `.env` file can also be used to set `PYTHONPATH=.` if needed, although typically not required if running commands from the `backend` directory.

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
2.  **Environment Variables:** Verify that:
    *   `frontend/.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` correctly set.
    *   `backend/.env` has `OPENAI_API_KEY` correctly set.
3.  **Login:** Access the frontend application (usually `http://localhost:3000`) and log in.
4.  **Navigate:** Go to the document upload page (e.g., Client Dashboard > Documents > Upload).
5.  **Upload:** Select a test document (e.g., a text file, PDF) and optionally add a user query/note in the provided field. Click "Upload Document".
6.  **Backend Logs:** Observe the terminal running the backend server. You should see logs indicating the start of AI processing by `LawFirmCrewRunner`. If an OpenAI API key is configured, you'll see logs from CrewAI about agent execution. If not, mock processing logs will appear.
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
-   You will need to set the `OPENAI_API_KEY` (and any other backend environment variables like `GEMINI_API_KEY` if used) on your chosen deployment platform.
-   Ensure your deployment process installs dependencies from `backend/requirements.txt`. This is typically done via a `pip install -r requirements.txt` command during the build process.
-   Consider containerizing the backend with Docker for easier deployment, scalability, and environment consistency. (A `Dockerfile` is not yet provided but would be a good addition for production deployments).
-   You will need an ASGI server like Uvicorn (with Gunicorn as a process manager in production) to run the FastAPI application. The command would be similar to `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`.

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
