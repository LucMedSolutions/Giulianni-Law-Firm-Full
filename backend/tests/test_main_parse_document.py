import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
import uuid
from fastapi import BackgroundTasks # Import BackgroundTasks for patching its method

# Assuming your FastAPI app instance is named 'app' in 'backend.main'
from backend.main import app 

# --- Test Suite for /parse-document/ endpoint ---

@pytest.fixture
def client():
    """Provides a TestClient instance for making requests to the FastAPI app."""
    return TestClient(app)

# Test for successful document parsing request (202 Accepted)
@patch('fastapi.BackgroundTasks.add_task') # Patch the add_task method
@patch('backend.main.update_task_status')
@patch('backend.main.get_crew_runner_instance')
def test_parse_document_success(
    mock_get_crew_runner, 
    mock_update_task_status, 
    mock_bg_tasks_add_task, 
    client: TestClient
):
    # --- Arrange ---
    mock_file_path = "uploads/test_document.pdf"
    mock_bucket_name = "test-bucket"
    mock_filename = "test_document.pdf"
    mock_user_query = "Summarize this document."
    
    mock_generated_task_id = str(uuid.uuid4())
    mock_update_task_status.return_value = mock_generated_task_id

    mock_runner_instance = MagicMock()
    mock_run_crew_method = MagicMock() # This is runner.run_crew for parsing
    mock_runner_instance.run_crew = mock_run_crew_method
    mock_get_crew_runner.return_value = mock_runner_instance

    request_payload = {
        "file_path": mock_file_path,
        "bucket_name": mock_bucket_name,
        "filename": mock_filename,
        "user_query": mock_user_query
    }

    # --- Act ---
    response = client.post("/parse-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 202, response.text
    response_json = response.json()
    assert response_json["task_id"] == mock_generated_task_id
    assert response_json["initial_status"] == "queued"
    assert f"AI processing has been queued for document: {mock_filename}" in response_json["message"]

    # Assert update_task_status was called correctly for 'queued' status
    mock_update_task_status.assert_called_once_with(
        task_id=None,
        current_status='queued',
        details=f'AI processing queued for document: {mock_filename}.',
        crew_type='document_parser', 
        user_id=None # user_id is not explicitly passed to update_task_status in /parse-document/
    )

    # Assert that the runner's run_crew method was scheduled via background_tasks.add_task
    mock_get_crew_runner.assert_called_once() 
    
    expected_document_info = {
        "file_path": mock_file_path,
        "bucket_name": mock_bucket_name,
        "filename": mock_filename
    }
    mock_bg_tasks_add_task.assert_called_once_with(
        mock_runner_instance.run_crew, # The method to be run
        task_id_from_endpoint=mock_generated_task_id,
        document_info=expected_document_info,
        user_query=mock_user_query
    )

def test_parse_document_invalid_filename_extension(client: TestClient):
    # --- Arrange ---
    request_payload = {
        "file_path": "uploads/test_document.zip", # Invalid extension based on default ALLOWED_EXTENSIONS
        "bucket_name": "test-bucket",
        "filename": "test_document.zip",
        "user_query": "Summarize this document."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 400, response.text
    response_json = response.json()
    assert "Invalid file type based on filename extension: '.zip'" in response_json["detail"]

def test_parse_document_missing_filename_extension(client: TestClient):
    # --- Arrange ---
    request_payload = {
        "file_path": "uploads/test_document_no_ext",
        "bucket_name": "test-bucket",
        "filename": "test_document_no_ext", # No extension
        "user_query": "Summarize this document."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 400, response.text
    response_json = response.json()
    assert "Could not determine file extension for filename: test_document_no_ext" in response_json["detail"]
    

def test_parse_document_invalid_request_body(client: TestClient):
    # --- Arrange ---
    # Missing 'file_path' which is required
    request_payload = {
        "bucket_name": "test-bucket",
        "filename": "test_document.pdf",
        "user_query": "Summarize this document."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 422 # Unprocessable Entity (from Pydantic validation)
    response_json = response.json()
    assert "detail" in response_json
    assert any("file_path" in error["loc"] and error["type"] == "missing" for error in response_json["detail"])

# Add more tests as needed, e.g., for error handling if update_task_status fails,
# or if get_crew_runner_instance raises an exception.
# However, those are less common scenarios for endpoint logic itself.
# Testing the crew execution (what happens inside runner.run_crew) is done in test_crew_runner.py.
