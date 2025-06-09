import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
from fastapi import BackgroundTasks # Import BackgroundTasks for mocking

# Import the FastAPI app instance from your main application file
from backend.main import app

# Instantiate the TestClient
client = TestClient(app)

# --- Reusable Fixtures ---
@pytest.fixture
def mock_bg_tasks_fixture():
    """Fixture for mocking BackgroundTasks and cleaning up dependency overrides."""
    mock = MagicMock(spec=BackgroundTasks)
    original_override = app.dependency_overrides.get(BackgroundTasks)
    app.dependency_overrides[BackgroundTasks] = lambda: mock
    yield mock # Provide the mock to the test
    # Cleanup: Restore original dependency override if it existed, otherwise remove
    if original_override:
        app.dependency_overrides[BackgroundTasks] = original_override
    else:
        del app.dependency_overrides[BackgroundTasks]


# --- Test Cases for API Endpoints ---

def test_read_main_root_is_not_defined_but_should_not_crash_client():
    response_docs = client.get("/docs")
    assert response_docs.status_code == 200
    response_redoc = client.get("/redoc")
    assert response_redoc.status_code == 200

@patch('backend.main.get_crew_runner_instance')
@patch('agents.status.update_task_status') # Patch at source
def test_parse_document_success(
    mock_agents_update_task_status, # Patched update_task_status
    mock_get_crew_runner_instance,
    mock_bg_tasks_fixture: MagicMock # Use the BackgroundTasks mock fixture
):
    # --- Arrange ---
    mock_runner = MagicMock()
    mock_run_crew_method = MagicMock()
    mock_runner.run_crew = mock_run_crew_method
    mock_get_crew_runner_instance.return_value = mock_runner

    mock_task_id = "test-task-123"
    mock_agents_update_task_status.return_value = mock_task_id # For the initial 'queued' status

    payload = {
        "file_path": "user/uploads/test.pdf",
        "bucket_name": "documents",
        "filename": "test.pdf",
        "user_query": "Summarize this document."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=payload)

    # --- Assert ---
    assert response.status_code == 202, response.text
    json_response = response.json()
    assert json_response["task_id"] == mock_task_id
    assert json_response["initial_status"] == "queued"
    assert f"AI processing has been queued for document: {payload['filename']}" in json_response["message"]

    mock_agents_update_task_status.assert_called_once_with(
        task_id=None,
        current_status='queued',
        details=f'AI processing queued for document: {payload["filename"]}.',
        crew_type='document_parser',
        user_id=None
    )
    mock_get_crew_runner_instance.assert_called_once()
    mock_bg_tasks_fixture.add_task.assert_called_once_with(
        mock_runner.run_crew, # The method to be run
        task_id_from_endpoint=mock_task_id,
        document_info={
            "file_path": payload["file_path"],
            "bucket_name": payload["bucket_name"],
            "filename": payload["filename"]
        },
        user_query=payload["user_query"]
    )

def test_parse_document_invalid_extension():
    payload = {
        "file_path": "user/uploads/test.zip",
        "bucket_name": "documents",
        "filename": "test.zip", # Invalid extension
        "user_query": "Summarize this document."
    }
    response = client.post("/parse-document/", json=payload)

    assert response.status_code == 400
    json_response = response.json()
    assert "Invalid file type based on filename extension: '.zip'" in json_response["detail"]
    assert "Allowed extensions" in json_response["detail"]


@patch('agents.status.update_task_status') # Patch at source
@patch('backend.main.get_crew_runner_instance') # Still need to mock this
def test_parse_document_failed_to_enqueue_task(
    mock_get_crew_runner_instance, # Mock for get_crew_runner_instance
    mock_agents_update_task_status, # Mock for update_task_status
    mock_bg_tasks_fixture: MagicMock # Use the BackgroundTasks mock fixture
):
    # --- Arrange ---
    mock_runner = MagicMock() # Mock the runner instance
    mock_get_crew_runner_instance.return_value = mock_runner # get_crew_runner_instance returns the mock_runner

    queued_task_id = "queued-task-id-failure"
    # Simulate first call (queuing) succeeds, second call (error update) also uses this mock
    mock_agents_update_task_status.return_value = queued_task_id

    # Simulate BackgroundTasks.add_task failing
    mock_bg_tasks_fixture.add_task.side_effect = Exception("Failed to add task to queue")

    payload = {
        "file_path": "user/uploads/test.docx",
        "bucket_name": "documents",
        "filename": "test.docx",
        "user_query": "Summarize."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    json_response = response.json()
    assert "Failed to enqueue background task for crew execution: Failed to add task to queue" in json_response["detail"]

    # Verify update_task_status was called twice:
    # First for 'queued'
    # Second for 'error' because add_task failed
    assert mock_agents_update_task_status.call_count == 2
    mock_agents_update_task_status.assert_any_call(
        task_id=None,
        current_status='queued',
        details=ANY,
        crew_type=ANY,
        user_id=ANY
    )
    mock_agents_update_task_status.assert_called_with( # The second, error-setting call
        task_id=queued_task_id,
        current_status='error',
        details="Failed to enqueue crew task: Failed to add task to queue"
    )
    mock_bg_tasks_fixture.add_task.assert_called_once() # Ensure add_task was attempted


@patch('agents.status.update_task_status', side_effect=Exception("DB connection error during status update"))
def test_parse_document_initial_status_update_fails(
    mock_agents_update_task_status, # Mock for update_task_status
    mock_bg_tasks_fixture: MagicMock # To ensure add_task is not called
):
    # --- Arrange ---
    payload = {
        "file_path": "user/uploads/test.pdf",
        "bucket_name": "documents",
        "filename": "test.pdf",
        "user_query": "Summarize this document."
    }

    # --- Act ---
    response = client.post("/parse-document/", json=payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    json_response = response.json()
    # This detail comes from the direct exception in update_task_status, not an HTTPException in the endpoint
    # The default exception handler in FastAPI will convert unhandled exceptions to 500.
    # For more specific error messages, the endpoint would need a try-except around the initial update_task_status.
    # Based on current main.py, a direct Exception will lead to a generic 500 if not caught.
    # Let's assume main.py is updated to catch this:
    # try:
    #    new_task_id = update_task_status(...)
    # except Exception as e:
    #    raise HTTPException(status_code=500, detail=f"Failed to create initial task status: {str(e)}")
    # If main.py has such a try-except, the detail will be more specific.
    # For now, asserting the 500 is key. If main.py is not updated, the detail might be "Internal Server Error".
    # Given the current main.py, it will be caught by the default FastAPI handler.
    # The plan was to assert "appropriate error detail". This implies the endpoint should handle it.
    # Let's assume the endpoint *will* be updated to catch this for a better error message.
    # If main.py is NOT changed, this test needs to expect "Internal Server Error" or similar.
    # For now, I will write the test as if main.py handles it gracefully.
    # This test will FAILS if main.py's /parse-document/ does not wrap initial update_task_status in try-except.
    # The prompt for this subtask does not include modifying main.py for this, so I'll test current behavior.
    # Current main.py does not have try-catch around the first update_task_status.
    # So an exception here will bubble up and result in a generic 500.
    # For a more robust test, the test should reflect this.
    # However, the prompt's goal is "Expand tests", implying testing existing handler or adding them.
    # I'll test as if the handler *should* be there, and if it fails, it indicates a gap in main.py or test.
    # The current main.py *does not* have a try-except around the first call to update_task_status.
    # So, this test will expect a generic 500, or I should first modify main.py.
    # The instructions say "Refactor test_parse_document_crew_runner_exception" and "Add Tests for More API Error Scenarios".
    # It does not say "Modify main.py error handling for /parse-document/ initial status update".
    # So, I will test the *current* behavior of main.py.
    # A raw exception from update_task_status will be caught by FastAPI's default error handler.
    assert "Internal Server Error" in response.json()["detail"] # Default for unhandled non-HTTPException

    mock_agents_update_task_status.assert_called_once()
    mock_bg_tasks_fixture.add_task.assert_not_called() # Should not be called if status update fails


@patch('backend.main.get_agent_status') # Patching at the location it's imported into main
def test_agent_status_found(mock_main_get_agent_status):
    mock_main_get_agent_status.return_value = {
        "task_id": "test-task-123",
        "status": "completed",
        "message": "Task finished successfully.",
        "last_updated": "2023-01-01T12:00:00Z",
        "details": {"result": "some data"}
    }

    response = client.get("/agent-status/?task_id=test-task-123")

    assert response.status_code == 200
    json_response = response.json()
    assert json_response["task_id"] == "test-task-123"
    assert json_response["status"] == "completed"
    mock_main_get_agent_status.assert_called_once_with("test-task-123")

@patch('backend.main.get_agent_status')
def test_agent_status_not_found(mock_main_get_agent_status):
    mock_main_get_agent_status.return_value = {
        "status": "not_found",
        "message": "Task ID not found."
    }

    response = client.get("/agent-status/?task_id=unknown-id")

    assert response.status_code == 404
    json_response = response.json()
    assert "Task ID not found" in json_response["detail"]
    mock_main_get_agent_status.assert_called_once_with("unknown-id")

[end of backend/tests/test_main.py]
