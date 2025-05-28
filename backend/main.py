from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
# Assuming these files are in backend/agents/
from agents.crew_runner import get_crew_runner_instance 
from agents.task_generator import generate_legal_tasks
from agents.status import get_agent_status, update_task_status
import shutil # For saving file if needed, or reading content

app = FastAPI(title="Giulianni Law Firm AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize crew runner (if it's a class instance needed globally)
# crew_runner = get_crew_runner_instance() 

@app.post("/parse-document/")
async def parse_document_endpoint(file: UploadFile = File(...)):
    # In a real scenario, you might save the file or process its content
    # For now, just acknowledge receipt and simulate some action.
    # You could also call update_task_status here if parsing is a task
    # task_id = f"parse_{file.filename}" # Example task_id
    # update_task_status(task_id, "processing", f"Parsing document: {file.filename}")

    # Simulate calling a task generator or crew runner if parsing itself is an AI task
    # For example, if task_generator can extract info:
    # extracted_info = generate_legal_tasks({"filename": file.filename, "content_type": file.content_type, "size": file.size}, "extract key entities")
    
    print(f"Received file: {file.filename}, content-type: {file.content_type}")
    # For this placeholder, we'll just return file info
    # In a real app, you'd likely pass this to an agent or task generator
    return JSONResponse(
        content={
            "message": "Document received for parsing (placeholder).",
            "filename": file.filename,
            "content_type": file.content_type,
            # "processing_status": get_agent_status(task_id) # Example
        },
        status_code=200
    )

@app.post("/generate-task/")
async def generate_task_endpoint(task_request: dict): # Assuming task_request is a JSON body
    # Example: task_request = {"document_id": "doc123", "user_query": "Summarize this document"}
    document_info = task_request.get("document_info", {}) # e.g. from a previous parsing step
    user_query = task_request.get("user_query", "")
    
    # Call the placeholder task generator
    generated_tasks_response = generate_legal_tasks(document_info, user_query)
    
    # If tasks are generated, you might want to kick off a crew or update status
    # For example, if generate_legal_tasks returns tasks to be run by a crew:
    # if generated_tasks_response.get("status") == "success":
    #    tasks_for_crew = generated_tasks_response.get("generated_tasks")
    #    # runner = get_crew_runner_instance()
    #    # crew_result = runner.run_crew({"tasks": tasks_for_crew, "document_id": document_info.get("id")})
    #    # return {"tasks_generated": tasks_for_crew, "crew_status": crew_result}

    return JSONResponse(content=generated_tasks_response, status_code=200)

@app.get("/agent-status/")
async def agent_status_endpoint(task_id: str):
    # Call the placeholder status check
    status_info = get_agent_status(task_id)
    if status_info.get("status") == "not_found":
        raise HTTPException(status_code=404, detail=status_info.get("message"))
    return JSONResponse(content=status_info, status_code=200)

# Example of how you might use update_task_status (e.g., for a long-running background task)
# This is just illustrative, as HTTP requests are typically short-lived.
# For actual long tasks, you'd use background tasks or a task queue.
@app.post("/test-update-status/") 
async def test_update_status_endpoint(task_id: str, status: str, details: str = ""):
    update_task_status(task_id, status, details)
    return JSONResponse({"message": f"Status for {task_id} updated to {status}"})

if __name__ == "__main__":
    import uvicorn
    # Make sure PYTHONPATH includes the current directory for agent imports
    # This is usually handled by how uvicorn is run or by setting it in .env
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
