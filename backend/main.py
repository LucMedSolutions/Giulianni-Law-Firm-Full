# backend/main.py
# This file defines the FastAPI application, its endpoints, and handles incoming HTTP requests.
# It serves as the main entry point for the backend API.

import os # Added for potential environment variable usage in CORS
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware # For handling Cross-Origin Resource Sharing
from pydantic import BaseModel # For defining data models for request bodies

# Import custom modules for agent interaction and status tracking
from agents.crew_runner import get_crew_runner_instance 
from agents.task_generator import generate_legal_tasks # Still used by the (potentially deprecated) /generate-task/ endpoint
from agents.status import get_agent_status, update_task_status # update_task_status used for fallback error handling

# Initialize the FastAPI application
app = FastAPI(title="Giulianni Law Firm AI Backend")

# Configure CORS middleware to allow requests from specified frontend origins.
# This is important for development and production when frontend and backend are on different domains/ports.
# TODO: For production, restrict allow_origins to specific frontend domains 
# for enhanced security. This can be done via environment variables.
# Example: allow_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://your-prod-domain.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Changed for flexibility, see TODO above
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"], # Allows all HTTP methods
    allow_headers=["*"], # Allows all headers
)

# Pydantic model for the /parse-document/ request body.
# This ensures that incoming requests have the expected structure and data types.
class ParseDocumentRequest(BaseModel):
    file_url: str # URL of the document to be processed
    filename: str # Original filename of the document
    user_query: str | None = None # Optional user query related to the document

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
    print(f"Received /parse-document/ request for file: {request.filename}, URL: {request.file_url}, Query: {request.user_query}")
    
    # Get an instance of the LawFirmCrewRunner.
    runner = get_crew_runner_instance()
    # Prepare document information for the crew runner.
    # Note: 'extracted_text' could also be passed here if available from a pre-processing step.
    document_info = {"file_url": request.file_url, "filename": request.filename} 
    
    # TODO: Implement true asynchronous execution for runner.run_crew.
    # This would involve using background_tasks.add_task or a dedicated task queue (e.g., Celery).
    # Example: background_tasks.add_task(runner.run_crew, document_info=document_info, user_query=request.user_query)
    # For now, runner.run_crew is called directly, making this endpoint synchronous for the crew execution part.
    result = runner.run_crew(document_info=document_info, user_query=request.user_query)
    
    print(f"Crew run result for {request.filename}: {result}")

    # Process the result from the crew run.
    if result and result.get("status") in ["success", "error", "completed"]: 
        # 'completed' from crew_runner means the crew finished its process, map to 'success' for client.
        initial_status = result.get("status")
        if initial_status == "completed": 
            initial_status = "success" 
            
        response_status_code = 200 if initial_status == "success" else 500
        
        content_to_return = {"task_id": result.get("task_id"), "initial_status": initial_status}
        
        # Add a message to the response based on the outcome.
        if initial_status == "success" and result.get("results"):
            content_to_return["message"] = "Crew run initiated successfully. Check task status for updates/results."
            # Optionally, a summary of results could be included here:
            # content_to_return["details_summary"] = result.get("results", {}).get("summary", "No summary available.")
        elif initial_status == "error":
             content_to_return["message"] = result.get("message", "Crew run reported an error.")

        print(f"Responding to /parse-document/ for {request.filename} with task_id: {result.get('task_id')}, status: {initial_status}")
        return JSONResponse(content=content_to_return, status_code=response_status_code)
    else:
        # Fallback for unexpected results from the crew runner.
        # This indicates an issue in the crew_runner logic or an unhandled case.
        print(f"Error: Unexpected result from run_crew for {request.filename}: {result}")
        # Create an error status record.
        task_id = update_task_status(task_id=None, current_status='error', details='Failed to initiate crew run properly or unexpected result from runner.')
        # In a production system, log this error more robustly (e.g., to a dedicated logging service).
        raise HTTPException(status_code=500, detail={"task_id": task_id, "message": "Failed to initiate crew run or runner returned an unexpected result."})

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
