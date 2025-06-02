import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
import uuid

# Assuming your FastAPI app instance is named 'app' in 'backend.main'
from backend.main import app 

# --- Test Suite for /generate-document/ endpoint ---

CLIENT_INTAKE_DATA_TABLE_NAME = "client_intake_data" # As used in the endpoint

@pytest.fixture
def client():
    """Provides a TestClient instance for making requests to the FastAPI app."""
    return TestClient(app)

@pytest.fixture
def mock_supabase_client_in_main():
    """Mocks the Supabase client used within the /generate-document/ endpoint."""
    mock_supabase = MagicMock()
    # Mock the chain of calls: supabase.table("...").select("...").eq("...", "...").maybe_single().execute()
    mock_execute = MagicMock()
    mock_maybe_single = MagicMock(execute=mock_execute)
    mock_eq = MagicMock(maybe_single=mock_maybe_single)
    mock_select = MagicMock(eq=mock_eq)
    mock_table = MagicMock(select=mock_select)
    mock_supabase.table.return_value = mock_table
    
    return mock_supabase, mock_table, mock_select, mock_eq, mock_maybe_single, mock_execute


from fastapi import BackgroundTasks # Import BackgroundTasks for patching its method

# Test for successful document generation request (202 Accepted)
@patch('fastapi.BackgroundTasks.add_task') # Patch the add_task method
@patch('backend.main.update_task_status')
@patch('backend.main.get_crew_runner_instance')
@patch('backend.main.create_client') # Mocks supabase.create_client used in the endpoint
def test_generate_document_success(
    mock_main_create_supabase_client,
    mock_get_crew_runner, 
    mock_update_task_status, 
    mock_bg_tasks_add_task, # Add the new mock for add_task
    client: TestClient,
    mock_supabase_client_in_main # Fixture providing specific mocks for chained calls
):
    # --- Arrange ---
    # Unpack mocks for Supabase client chained calls
    mock_supabase_instance, mock_table_func, _, _, _, mock_execute_func = mock_supabase_client_in_main
    mock_main_create_supabase_client.return_value = mock_supabase_instance # create_client() in endpoint returns our main mock

    # Configure Supabase client mock for successful client_intake_data fetch
    mock_case_id = str(uuid.uuid4())
    mock_user_id = str(uuid.uuid4())
    mock_client_data = {"client_name": "Test Client Inc.", "details": "Project X"}
    mock_execute_func.return_value = MagicMock(data={"data": mock_client_data}) # Simulate data found

    # Configure update_task_status mock
    mock_generated_task_id = str(uuid.uuid4())
    mock_update_task_status.return_value = mock_generated_task_id

    # Configure crew_runner mock
    mock_runner_instance = MagicMock()
    mock_run_drafting_crew_method = MagicMock()
    mock_runner_instance.run_document_drafting_crew = mock_run_drafting_crew_method
    mock_get_crew_runner.return_value = mock_runner_instance

    request_payload = {
        "case_id": mock_case_id,
        "operator_instructions": "Please be very formal.",
        "template_id": "nda_v2.jinja2",
        "user_id": mock_user_id
    }

    # --- Act ---
    response = client.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 202, response.text
    response_json = response.json()
    assert response_json["task_id"] == mock_generated_task_id
    assert response_json["initial_status"] == "queued"
    assert "Document generation has been queued" in response_json["message"]

    # Assert Supabase client was called correctly to fetch client_intake_data
    mock_main_create_supabase_client.assert_called_once() # With os.getenv values
    mock_table_func.assert_called_with(CLIENT_INTAKE_DATA_TABLE_NAME)
    mock_table_func.return_value.select.assert_called_with("data")
    mock_table_func.return_value.select.return_value.eq.assert_called_with("case_id", mock_case_id)
    mock_table_func.return_value.select.return_value.eq.return_value.maybe_single.assert_called_once()
    mock_execute_func.assert_called_once()


    # Assert update_task_status was called correctly for 'queued' status
    mock_update_task_status.assert_called_once_with(
        task_id=None,
        current_status='queued',
        details=f'Document generation queued for case: {mock_case_id}, template: {request_payload["template_id"]}.',
        crew_type='document_drafter',
        user_id=mock_user_id,
        result_data={"case_id": mock_case_id, "template_id": request_payload["template_id"]}
    )

    # Assert that the runner's drafting method was scheduled via background_tasks.add_task
    # Direct assertion on background_tasks.add_task is tricky with TestClient
    # Instead, we check if the target method on the runner was called (it will be if add_task worked)
    # This requires background tasks to execute immediately in tests or be mocked to do so.
    # For unit tests, it's common to verify the call to add_task itself if possible,
    # or trust that if add_task was called, FastAPI handles the rest.
    # Here, we'll assume direct call for simplicity or if background tasks run in test mode.
    # If BackgroundTasks are truly backgrounded, this check needs adjustment.
    # As a proxy: check the mock_run_drafting_crew_method was called.
    # This requires the test client to execute background tasks or for us to mock add_task.
    # For this subtask, we'll assume the call to add_task implies the method will be called.
    mock_get_crew_runner.assert_called_once() # Verify runner instance was obtained

    # Assert that background_tasks.add_task was called correctly
    mock_bg_tasks_add_task.assert_called_once_with(
        mock_runner_instance.run_document_drafting_crew, # The method to be run
        task_id_from_endpoint=mock_generated_task_id,
        case_id=mock_case_id,
        client_data_json=mock_client_data,
        operator_instructions=request_payload["operator_instructions"],
        template_id=request_payload["template_id"],
        user_id=mock_user_id
    )


@patch('backend.main.update_task_status') # Keep this to avoid real status updates
@patch('backend.main.get_crew_runner_instance') # Keep this to avoid real crew runs
@patch('backend.main.create_client')
def test_generate_document_client_data_not_found(
    mock_main_create_supabase_client,
    mock_get_crew_runner,
    mock_update_task_status_func, # Renamed to avoid conflict with other mock
    client: TestClient,
    mock_supabase_client_in_main
):
    # --- Arrange ---
    mock_supabase_instance, _, _, _, _, mock_execute_func = mock_supabase_client_in_main
    mock_main_create_supabase_client.return_value = mock_supabase_instance

    # Configure Supabase client mock for no data found
    mock_execute_func.return_value = MagicMock(data=None) # Simulate no data found

    mock_case_id = str(uuid.uuid4())
    request_payload = {
        "case_id": mock_case_id,
        "operator_instructions": "Test",
        "template_id": "test.jinja2"
    }

    # --- Act ---
    response = client.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 404, response.text
    response_json = response.json()
    assert response_json["detail"] == f"No client intake data found for case_id: {mock_case_id}"
    
    # Ensure update_task_status was NOT called if client data fetch fails early
    mock_update_task_status_func.assert_not_called()
    mock_get_crew_runner.assert_not_called()


def test_generate_document_invalid_request_body(client: TestClient):
    # --- Arrange ---
    # Missing 'case_id' which is required
    request_payload = {
        "operator_instructions": "Test instructions",
        "template_id": "some_template.jinja2"
    }

    # --- Act ---
    response = client.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 422 # Unprocessable Entity
    response_json = response.json()
    assert "detail" in response_json
    # Check that the error detail mentions 'case_id' is missing
    assert any("case_id" in error["loc"] and error["type"] == "missing" for error in response_json["detail"])


@patch('backend.main.update_task_status')
@patch('backend.main.get_crew_runner_instance')
@patch('backend.main.create_client')
def test_generate_document_supabase_cfg_missing(
    mock_main_create_supabase_client,
    mock_get_crew_runner_inst, 
    mock_update_task_status_call, 
    client: TestClient,
    monkeypatch # To modify environment variables
):
    # --- Arrange ---
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)

    # This test relies on the endpoint re-checking env vars.
    # If create_client is globally initialized, this test setup would need to change.
    
    request_payload = {
        "case_id": str(uuid.uuid4()),
        "operator_instructions": "Test",
        "template_id": "test.jinja2"
    }

    # --- Act ---
    response = client.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert "Supabase configuration missing" in response.json()["detail"]
    mock_main_create_supabase_client.assert_not_called() # Should fail before client creation attempt in endpoint
    mock_update_task_status_call.assert_not_called()
    mock_get_crew_runner_inst.assert_not_called()
