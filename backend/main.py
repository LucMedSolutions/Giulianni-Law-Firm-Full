# backend/main.py
# This file defines the FastAPI application, its endpoints, and handles incoming HTTP requests.
# It serves as the main entry point for the backend API.

import os # For environment variables
from dotenv import load_dotenv # For loading .env file for local development
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware # For handling Cross-Origin Resource Sharing
from pydantic import BaseModel # For defining data models for request bodies

# Import custom modules for agent interaction and status tracking
from agents.crew_runner import get_crew_runner_instance 
from agents.task_generator import generate_legal_tasks # Still used by the (potentially deprecated) /generate-task/ endpoint
from agents.status import get_agent_status, update_task_status # update_task_status used for fallback error handling
from supabase import create_client, Client as SupabaseClient # Added for direct Supabase interaction in endpoints

# Load environment variables from .env file (especially for local development)
load_dotenv()

# Initialize the FastAPI application
app = FastAPI(title="Giulianni Law Firm AI Backend")

# Configure CORS middleware
# Fetch allowed origins from environment variable, defaulting for local development
default_allowed_origins = "http://localhost:3000" # Default if ALLOWED_ORIGINS is not set
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", default_allowed_origins)
allowed_origins_list = [origin.strip() for origin in allowed_origins_str.split(',')]

print(f"Configuring CORS with allowed origins: {allowed_origins_list}") # For debugging/verification

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list, # Use the list from environment variables
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"], # Allows all HTTP methods
    allow_headers=["*"], # Allows all headers
)

# Pydantic model for the /parse-document/ request body.
# This ensures that incoming requests have the expected structure and data types.
class ParseDocumentRequest(BaseModel):
    file_path: str # Path of the document in Supabase storage
    bucket_name: str # Name of the Supabase bucket where the file is stored
    filename: str # Original filename of the document
    user_query: str | None = None # Optional user query related to the document

class GenerateDocumentRequest(BaseModel):
    case_id: str  # Assuming UUID as string
    operator_instructions: str
    template_id: str  # e.g., "nda_template.jinja2"
    user_id: str | None = None # Assuming UUID as string, optional for now

# Global instance of the crew runner (commented out as get_crew_runner_instance() is light and called per request)
# If crew_runner initialization were heavy, a global instance might be preferred.
# crew_runner = get_crew_runner_instance() 

@app.post("/parse-document/")
async def parse_document_endpoint(request: ParseDocumentRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to initiate document parsing and AI processing.
    It receives document information and an optional user query, then starts a crew run.
    Currently, the crew run is synchronous but is designed to be made asynchronous.
    """
    print(f"Received /parse-document/ request for file: {request.filename}, Path: {request.file_path}, Bucket: {request.bucket_name}, Query: {request.user_query}")

    # --- Server-Side Filename Validation ---
    # TODO: This filename extension check is a basic validation.
    # Robust server-side validation should be enforced by Supabase Storage policies/functions upon upload.
    ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.txt', '.csv']
    try:
        file_ext = os.path.splitext(request.filename)[1].lower()
        if not file_ext: # Check if extension could be extracted
             raise HTTPException(status_code=400, detail=f"Could not determine file extension for filename: {request.filename}. An extension is required.")
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid file type based on filename extension: '{file_ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}")
    except Exception as e: # Catch any error during filename processing
        print(f"Error during filename validation for {request.filename}: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid filename or extension: {request.filename}. Error: {str(e)}")
    # --- End Server-Side Filename Validation ---
    
    # Get an instance of the LawFirmCrewRunner.
    runner = get_crew_runner_instance()
    # Prepare document information for the crew runner.
    # The crew_runner will be responsible for generating a signed URL if needed.
    document_info = {
        "file_path": request.file_path,
        "bucket_name": request.bucket_name,
        "filename": request.filename
    }
    
    # --- Asynchronous Task Execution ---

    # 1. Create an initial task record in the database.
    # This task_id will be returned to the client immediately.
    initial_task_details = f'AI processing queued for document: {request.filename}.'
    new_task_id = update_task_status(
        task_id=None,  # Let status.py generate a new UUID
        current_status='queued',
        details=initial_task_details,
        crew_type='document_parser', # Specify the type of crew handling this
        user_id=None  # Placeholder for user_id; to be integrated with auth later
    )
    print(f"Task {new_task_id} created and queued for {request.filename}.")

    # 2. Add the crew execution to background tasks.
    # The `new_task_id` is passed to `run_crew` to ensure it updates the correct task record.
    background_tasks.add_task(
        runner.run_crew,
        task_id_from_endpoint=new_task_id, # Pass the generated task_id here
        document_info=document_info,
        user_query=request.user_query
    )
    
    print(f"AI processing for {request.filename} (Task ID: {new_task_id}) has been added to background tasks.")

    # 3. Return a 202 Accepted response to the client.
    # This indicates that the request has been accepted for processing, but is not yet complete.
    return JSONResponse(
        content={
            "task_id": new_task_id,
            "initial_status": "queued",
            "message": f"AI processing has been queued for document: {request.filename}. Track status with task ID: {new_task_id}."
        },
        status_code=202  # HTTP 202 Accepted
    )

@app.post("/generate-document/")
async def generate_document_endpoint(request: GenerateDocumentRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to initiate AI-powered document generation.
    It fetches client data based on case_id, then queues a document drafting task.
    """
    print(f"Received /generate-document/ request for case: {request.case_id}, template: {request.template_id}")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_service_key:
        print("Error: Supabase URL or service key not configured on the server.")
        raise HTTPException(status_code=500, detail="Supabase configuration missing on server.")
    
    try:
        supabase: SupabaseClient = create_client(supabase_url, supabase_service_key)
    except Exception as e:
        print(f"Error initializing Supabase client for /generate-document/: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize Supabase client: {str(e)}")

    client_data_json = None
    try:
        # Fetch client_data_json from 'client_intake_data' table
        # Assumes 'client_intake_data' table has 'case_id' (UUID) and 'data' (JSONB) columns.
        # IMPORTANT: Ensure RLS policies on 'client_intake_data' allow service_key access or appropriate user access.
        print(f"Fetching client_intake_data for case_id: {request.case_id}")
        response = supabase.table("client_intake_data").select("data").eq("case_id", request.case_id).maybe_single().execute()
        
        if response.data and response.data.get("data"):
            client_data_json = response.data["data"]
            print(f"Successfully fetched client_data for case {request.case_id}.")
        else:
            print(f"No client intake data found for case_id: {request.case_id}. Response: {response.data}")
            raise HTTPException(status_code=404, detail=f"No client intake data found for case_id: {request.case_id}")

    except HTTPException as http_exc: # Re-raise HTTPException
        raise http_exc
    except Exception as e: # Catch other Supabase or unexpected errors
        print(f"Error fetching client_intake_data for case {request.case_id}: {e}")
        # Log the full error for debugging if possible
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch client data: {str(e)}")

    # Create an initial task record for the document generation
    initial_task_details = f'Document generation queued for case: {request.case_id}, template: {request.template_id}.'
    try:
        new_task_id = update_task_status(
            task_id=None,  # Generate new ID
            current_status='queued',
            details=initial_task_details,
            crew_type='document_drafter',
            user_id=request.user_id,
            result_data = {"case_id": request.case_id, "template_id": request.template_id} # Store some initial context
        )
        print(f"Task {new_task_id} created for document generation (case: {request.case_id}, template: {request.template_id}).")
    except Exception as e:
        print(f"Error creating initial task status for document generation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create task status: {str(e)}")

    # Get an instance of the LawFirmCrewRunner
    runner = get_crew_runner_instance()

    # Add the document drafting task to background tasks
    try:
        background_tasks.add_task(
            runner.run_document_drafting_crew,
            task_id_from_endpoint=new_task_id,
            case_id=request.case_id,
            client_data_json=client_data_json,
            operator_instructions=request.operator_instructions,
            template_id=request.template_id,
            user_id=request.user_id
        )
        print(f"Document drafting for Task ID {new_task_id} added to background tasks.")
    except Exception as e:
        print(f"Error adding document drafting to background tasks: {e}")
        # Attempt to mark the previously created task as 'error'
        update_task_status(task_id=new_task_id, current_status='error', details=f"Failed to enqueue drafting task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enqueue document drafting task: {str(e)}")

    # Return a 202 Accepted response
    return JSONResponse(
        content={
            "task_id": new_task_id,
            "initial_status": "queued",
            "message": "Document generation has been queued. Track status with the provided task ID."
        },
        status_code=202  # HTTP 202 Accepted
    )


@app.post("/generate-task/")
async def generate_task_endpoint(task_request: dict): 
    """
    Endpoint to generate tasks based on document info and a user query.
    NOTE: This endpoint may be deprecated or refactored. The primary workflow
    for task generation is now intended to be handled by the TaskDefinitionAgent
    within the crew initiated by the /parse-document/ endpoint.
    This endpoint uses the older generate_legal_tasks function.
    """
    print(f"Received /generate-task/ request: {task_request}")
    
    document_info = task_request.get("document_info", {}) 
    user_query = task_request.get("user_query", "")
    
    # Calls the potentially deprecated task generator.
    generated_tasks_response = generate_legal_tasks(document_info, user_query)
    print(f"Response from /generate-task/: {generated_tasks_response}")
    return JSONResponse(content=generated_tasks_response, status_code=200)

@app.get("/agent-status/")
async def agent_status_endpoint(task_id: str):
    """
    Endpoint to retrieve the status of a specific agent task.
    Clients can poll this endpoint to get updates on long-running processes.
    """
    print(f"Received /agent-status/ request for task_id: {task_id}")
    status_info = get_agent_status(task_id)
    
    # If task ID is not found, return a 404 error.
    if status_info.get("status") == "not_found":
        print(f"Status for task_id {task_id}: Not Found")
        raise HTTPException(status_code=404, detail=status_info.get("message"))
    
    print(f"Status for task_id {task_id}: {status_info}")
    return JSONResponse(content=status_info, status_code=200)

@app.post("/test-update-status/") 
async def test_update_status_endpoint(task_id: str, status: str, details: str = ""):
    """
    A utility endpoint for testing the task status update mechanism.
    This is primarily for development and debugging purposes.
    """
    print(f"Received /test-update-status/ for task_id: {task_id}, status: {status}")
    update_task_status(task_id, status, details)
    response = {"message": f"Status for {task_id} updated to {status}"}
    print(f"Response from /test-update-status/: {response}")
    return JSONResponse(content=response)

# Main entry point for running the FastAPI application using Uvicorn.
# This is typically used for development. For production, a more robust ASGI server like Gunicorn might be used.
if __name__ == "__main__":
    import uvicorn
    # Ensure that the application can find the 'agents' module.
    # This might require setting PYTHONPATH or specific run configurations depending on the environment.
    print("Starting Uvicorn server for Giulianni Law Firm AI Backend...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) # reload=True enables auto-reloading on code changes.
