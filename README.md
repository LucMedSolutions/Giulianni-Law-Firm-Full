# Giulianni Law Firm - Integrated Automation System

This repository contains the integrated frontend and backend for the Giulianni Law Firm automation system.

## Project Structure

-   `frontend/`: Contains the Next.js frontend application.
    -   `src/`: Main source code for the Next.js app.
    -   `.env.local`: For frontend environment variables (Supabase keys).
    -   `package.json`: Frontend dependencies and scripts.
-   `backend/`: Contains the FastAPI backend application with Crew AI agents.
    -   `agents/`: Houses the Crew AI agent logic (crew_runner.py, task_generator.py, status.py).
    -   `main.py`: FastAPI application entry point, API endpoint definitions.
    -   `requirements.txt`: Backend Python dependencies.
    -   `.env`: For backend environment variables (e.g., API keys for services used by Crew AI, PYTHONPATH).

## Prerequisites

-   Node.js (v18 or later recommended) and npm/yarn for the frontend.
-   Python (v3.9 or later recommended) and pip for the backend.

## Setup Instructions

### 1. Clone the Repository (if you haven't already)

```bash
git clone <your-repo-url>
cd <your-repo-name>
```

### 2. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Create a Python virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Create and configure the backend environment file:
   - Create a file named `.env` in the `backend/` directory.
   - Add the following line to ensure Python can find your agent modules:
     ```
     PYTHONPATH=.:$PYTHONPATH 
     ```
   - Add any other backend-specific API keys or configurations needed for Crew AI or other services, for example:
     ```
     OPENAI_API_KEY="YOUR_OPENAI_API_KEY" 
     SERPER_API_KEY="YOUR_SERPER_API_KEY" 
     # Add other keys as required by your Crew AI tools and agents
     ```
   **Note:** Replace placeholder values with your actual keys.

### 3. Frontend Setup

Navigate to the frontend directory:
```bash
cd ../frontend 
```
(If you are in the `backend` directory. If you are at the root, just `cd frontend`)

Install JavaScript dependencies:
```bash
npm install
# or
# yarn install
```

Create and configure the frontend environment file:
   - Create a file named `.env.local` in the `frontend/` directory.
   - Add your Supabase project URL and anon key:
     ```
     NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
     NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
     ```
   **Important:** Replace `"YOUR_SUPABASE_URL"` and `"YOUR_SUPABASE_ANON_KEY"` with your actual Supabase project credentials. The application will not connect to Supabase auth without these.

## Running the Application Locally

### 1. Start the Backend Server

Navigate to the `backend/` directory and ensure your virtual environment is activated.
Run the FastAPI application:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be accessible at `http://localhost:8000`.

### 2. Start the Frontend Development Server

Navigate to the `frontend/` directory.
Run the Next.js development server:
```bash
npm run dev
# or
# yarn dev
```
The frontend application will be accessible at `http://localhost:3000` (or possibly `http://localhost:3001` if port 3000 is busy). Check your terminal output.

## API Endpoints (Backend - http://localhost:8000)

-   **`POST /parse-document/`**:
    -   Accepts a file upload (`multipart/form-data`).
    -   Purpose: Intended for uploading documents to be processed by AI agents.
    -   Current status: Placeholder returns info about the uploaded file.
-   **`POST /generate-task/`**:
    -   Accepts a JSON body (e.g., `{"document_info": {...}, "user_query": "..."}`).
    -   Purpose: Intended to trigger the generation of tasks for Crew AI agents.
    -   Current status: Calls placeholder `generate_legal_tasks` from `agents/task_generator.py`.
-   **`GET /agent-status/?task_id={task_id}`**:
    -   Accepts a `task_id` as a query parameter.
    -   Purpose: Intended to retrieve the status of an AI agent's task.
    -   Current status: Calls placeholder `get_agent_status` from `agents/status.py`.

## Important Next Steps

1.  **Populate Supabase Credentials:** Update `frontend/.env.local` with your actual Supabase URL and Anon Key to enable authentication.
2.  **Implement Crew AI Logic:** The Python files in `backend/agents/` (`crew_runner.py`, `task_generator.py`, `status.py`) currently contain placeholder structures. You need to fill these with the actual Crew AI agent definitions, task logic, and crew execution flows from your `giulianni-ai-agent` repository or develop them as needed.
3.  **Configure Backend API Keys:** Ensure all necessary API keys (e.g., for OpenAI, Serper, or other tools used by your Crew AI agents) are correctly set in `backend/.env`.
4.  **Develop Frontend Features:**
    *   Implement the actual Supabase login/signup logic in `frontend/src/app/login/page.js`.
    *   Build out UI components to interact with the backend API endpoints (e.g., file upload for document parsing, forms for task generation, status displays).
5.  **Testing:** Thoroughly test the frontend-backend integration, API calls, and the AI agent functionalities once implemented.
6.  **Deployment:**
    *   Consider platforms like Vercel (for Next.js frontend) and Railway/AWS (for FastAPI backend).
    *   Ensure environment variables are configured correctly on your chosen deployment platforms.
    *   The backend may need a `Procfile` or similar for platforms like Heroku/Railway (e.g., `web: uvicorn main:app --host 0.0.0.0 --port $PORT`).

## Contributing

Details on contributing to this project will be added here.
```
