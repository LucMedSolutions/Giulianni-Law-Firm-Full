import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the FastAPI app instance from your main application file
# Adjust the import path if your main.py is structured differently or app is named differently
from backend.main import app

# Instantiate the TestClient
client = TestClient(app)

# --- Mocks for external dependencies used by main.py endpoints ---

# Mock for get_crew_runner_instance used in /parse-document/
# This mock will be applied per test or per test class as needed.
# For now, defining a reusable mock object.
mock_crew_runner_instance = MagicMock()
# Configure the mock run_crew method that will be used by the instance
mock_run_crew_method = MagicMock()
mock_crew_runner_instance.run_crew = mock_run_crew_method

# Mock for get_agent_status used in /agent-status/
# This will be applied via patch in specific test functions.
mock_get_agent_status_function = MagicMock()


# --- Test Cases for API Endpoints ---

def test_read_main_root_is_not_defined_but_should_not_crash_client():
    # FastAPI typically serves docs at /docs and /redoc if no / endpoint is defined.
    # This test is more of a sanity check for the TestClient setup.
    response_docs = client.get("/docs")
    assert response_docs.status_code == 200
    response_redoc = client.get("/redoc")
    assert response_redoc.status_code == 200


@patch('backend.main.get_crew_runner_instance', return_value=mock_crew_runner_instance)
def test_parse_document_success(mock_get_runner):
    # Reset and configure run_crew for this specific test
    mock_run_crew_method.reset_mock()
    mock_run_crew_method.return_value = {
        "status": "success",
        "task_id": "test-task-123",
        "results": "Document processed successfully."
    }

    payload = {
        "file_path": "user/uploads/test.pdf",
        "bucket_name": "documents",
        "filename": "test.pdf",
        "user_query": "Summarize this document."
    }
    response = client.post("/parse-document/", json=payload)

    assert response.status_code == 200
    json_response = response.json()
    assert json_response["task_id"] == "test-task-123"
    assert json_response["initial_status"] == "success"
    assert "Crew run initiated successfully" in json_response["message"]
    mock_get_runner.assert_called_once()
    mock_run_crew_method.assert_called_once_with(
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

@patch('backend.main.get_crew_runner_instance', return_value=mock_crew_runner_instance)
def test_parse_document_crew_runner_exception(mock_get_runner):
    mock_run_crew_method.reset_mock()
    # Simulate an exception raised by the crew runner
    mock_run_crew_method.side_effect = Exception("Crew failed unexpectedly")

    # We also need to mock update_task_status for the error handling path in main.py
    with patch('backend.main.update_task_status', return_value="error-task-id") as mock_update_status:
        payload = {
            "file_path": "user/uploads/test.docx",
            "bucket_name": "documents",
            "filename": "test.docx",
            "user_query": "Summarize."
        }
        response = client.post("/parse-document/", json=payload)

        assert response.status_code == 500
        json_response = response.json()
        # The detail is now a dict due to how HTTPException is raised with a dict detail
        assert json_response["detail"]["task_id"] == "error-task-id"
        assert "Failed to initiate crew run or runner returned an unexpected result." in json_response["detail"]["message"]

        mock_get_runner.assert_called_once()
        mock_run_crew_method.assert_called_once()
        mock_update_status.assert_called_once()


@patch('backend.main.get_agent_status', new=mock_get_agent_status_function)
def test_agent_status_found():
    mock_get_agent_status_function.reset_mock()
    mock_get_agent_status_function.return_value = {
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
    mock_get_agent_status_function.assert_called_once_with("test-task-123")

@patch('backend.main.get_agent_status', new=mock_get_agent_status_function)
def test_agent_status_not_found():
    mock_get_agent_status_function.reset_mock()
    mock_get_agent_status_function.return_value = {
        "status": "not_found",
        "message": "Task ID not found."
    }

    response = client.get("/agent-status/?task_id=unknown-id")

    assert response.status_code == 404
    json_response = response.json()
    assert "Task ID not found" in json_response["detail"] # FastAPI wraps HTTPException detail in a "detail" key
    mock_get_agent_status_function.assert_called_once_with("unknown-id")

# TODO: Add tests for /generate-task/ and /test-update-status/ if they are still relevant.
# For now, focusing on the core endpoints involved in the document processing flow.
