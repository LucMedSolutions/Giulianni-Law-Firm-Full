import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
import uuid
import os

# Assuming your FastAPI app instance is named 'app' in 'backend.main'
from backend.main import app 
from fastapi import BackgroundTasks

# --- Test Suite for /generate-document/ endpoint ---

CLIENT_INTAKE_DATA_TABLE_NAME = "client_intake_data" # As used in the endpoint

@pytest.fixture
def client_fixture(): # Renamed to avoid conflict with TestClient instance
    """Provides a TestClient instance for making requests to the FastAPI app."""
    return TestClient(app)

@pytest.fixture
def mock_supabase_client_chain():
    """
    Mocks the Supabase client and its chained calls for fetching data.
    Returns a tuple of mocks: (mock_supabase_instance, mock_table_func, mock_select_func, mock_eq_func, mock_maybe_single_func, mock_execute_func)
    """
    mock_supabase_instance = MagicMock()
    mock_execute_func = MagicMock()
    mock_maybe_single_func = MagicMock(execute=mock_execute_func)
    mock_eq_func = MagicMock(maybe_single=mock_maybe_single_func)
    mock_select_func = MagicMock(eq=mock_eq_func)
    mock_table_func = MagicMock(select=mock_select_func)
    mock_supabase_instance.table.return_value = mock_table_func
    
    return mock_supabase_instance, mock_table_func, mock_select_func, mock_eq_func, mock_maybe_single_func, mock_execute_func

@pytest.fixture
def mock_bg_tasks():
    """Fixture for mocking BackgroundTasks."""
    mock = MagicMock(spec=BackgroundTasks)
    original_dependency = app.dependency_overrides.get(BackgroundTasks)
    app.dependency_overrides[BackgroundTasks] = lambda: mock
    yield mock
    if original_dependency:
        app.dependency_overrides[BackgroundTasks] = original_dependency
    else:
        del app.dependency_overrides[BackgroundTasks]


# Test for successful document generation request (202 Accepted)
@patch('backend.main.create_client') # Mocks supabase.create_client used in the endpoint
@patch('backend.main.get_crew_runner_instance')
@patch('agents.status.update_task_status') # Patching at source
def test_generate_document_success(
    mock_update_task_status, 
    mock_get_crew_runner,
    mock_main_create_supabase_client,
    client_fixture: TestClient, # Use the renamed fixture
    mock_supabase_client_chain, # Fixture providing specific mocks for chained calls
    mock_bg_tasks: MagicMock # Use the BackgroundTasks mock fixture
):
    # --- Arrange ---
    mock_supabase_instance, mock_table_func, _, _, _, mock_execute_func = mock_supabase_client_chain
    mock_main_create_supabase_client.return_value = mock_supabase_instance

    mock_case_id = str(uuid.uuid4())
    mock_user_id = str(uuid.uuid4())
    mock_client_data = {"client_name": "Test Client Inc.", "details": "Project X"}
    mock_execute_func.return_value = MagicMock(data={"data": mock_client_data})

    mock_generated_task_id = str(uuid.uuid4())
    mock_update_task_status.return_value = mock_generated_task_id

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
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 202, response.text
    response_json = response.json()
    assert response_json["task_id"] == mock_generated_task_id
    assert response_json["initial_status"] == "queued"
    assert "Document generation has been queued" in response_json["message"]

    mock_main_create_supabase_client.assert_called_once()
    mock_table_func.assert_called_with(CLIENT_INTAKE_DATA_TABLE_NAME)
    mock_table_func.return_value.select.assert_called_with("data")
    mock_table_func.return_value.select.return_value.eq.assert_called_with("case_id", mock_case_id)
    mock_table_func.return_value.select.return_value.eq.return_value.maybe_single.assert_called_once()
    mock_execute_func.assert_called_once()

    mock_update_task_status.assert_called_once_with(
        task_id=None,
        current_status='queued',
        details=f'Document generation queued for case: {mock_case_id}, template: {request_payload["template_id"]}.',
        crew_type='document_drafter',
        user_id=mock_user_id,
        result_data={"case_id": mock_case_id, "template_id": request_payload["template_id"]}
    )
    mock_get_crew_runner.assert_called_once()
    mock_bg_tasks.add_task.assert_called_once_with(
        mock_runner_instance.run_document_drafting_crew,
        task_id_from_endpoint=mock_generated_task_id,
        case_id=mock_case_id,
        client_data_json=mock_client_data,
        operator_instructions=request_payload["operator_instructions"],
        template_id=request_payload["template_id"],
        user_id=mock_user_id
    )

@patch('os.getenv')
def test_generate_document_supabase_cfg_missing(mock_os_getenv, client_fixture: TestClient):
    # --- Arrange ---
    def getenv_side_effect(key, default=None):
        if key == "SUPABASE_URL": return None
        if key == "SUPABASE_SERVICE_KEY": return None
        return os.environ.get(key, default) # Fallback for other env vars if any
    mock_os_getenv.side_effect = getenv_side_effect

    request_payload = {"case_id": "test", "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert response.json()["detail"] == "Supabase configuration missing on server."

@patch('backend.main.create_client', side_effect=Exception("Failed to connect to Supabase"))
def test_generate_document_supabase_client_init_fails(mock_create_client, client_fixture: TestClient):
    # --- Arrange ---
    request_payload = {"case_id": "test", "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert "Failed to initialize Supabase client: Failed to connect to Supabase" in response.json()["detail"]

@patch('backend.main.create_client')
def test_generate_document_client_data_not_found(
    mock_main_create_supabase_client,
    client_fixture: TestClient,
    mock_supabase_client_chain
):
    # --- Arrange ---
    mock_supabase_instance, _, _, _, _, mock_execute_func = mock_supabase_client_chain
    mock_main_create_supabase_client.return_value = mock_supabase_instance
    mock_execute_func.return_value = MagicMock(data=None) # Simulate no data found

    mock_case_id = str(uuid.uuid4())
    request_payload = {"case_id": mock_case_id, "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == f"No client intake data found for case_id: {mock_case_id}"

@patch('backend.main.create_client')
def test_generate_document_supabase_error_fetching_data(
    mock_main_create_supabase_client,
    client_fixture: TestClient,
    mock_supabase_client_chain
):
    # --- Arrange ---
    mock_supabase_instance, _, _, _, _, mock_execute_func = mock_supabase_client_chain
    mock_main_create_supabase_client.return_value = mock_supabase_instance
    mock_execute_func.side_effect = Exception("Database connection error")

    mock_case_id = str(uuid.uuid4())
    request_payload = {"case_id": mock_case_id, "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert "Failed to fetch client data: Database connection error" in response.json()["detail"]

@patch('backend.main.create_client')
@patch('agents.status.update_task_status', side_effect=Exception("Failed to write to status table"))
def test_generate_document_error_creating_initial_task(
    mock_update_task_status,
    mock_main_create_supabase_client,
    client_fixture: TestClient,
    mock_supabase_client_chain
):
    # --- Arrange ---
    mock_supabase_instance, _, _, _, _, mock_execute_func = mock_supabase_client_chain
    mock_main_create_supabase_client.return_value = mock_supabase_instance
    mock_execute_func.return_value = MagicMock(data={"data": {"client_name": "Test"}}) # Successful data fetch

    request_payload = {"case_id": "test", "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert "Failed to create task status: Failed to write to status table" in response.json()["detail"]

@patch('backend.main.create_client')
@patch('agents.status.update_task_status')
@patch('backend.main.get_crew_runner_instance')
def test_generate_document_error_adding_to_background(
    mock_get_crew_runner,
    mock_update_task_status,
    mock_main_create_supabase_client,
    client_fixture: TestClient,
    mock_supabase_client_chain,
    mock_bg_tasks: MagicMock # Use the BackgroundTasks mock fixture
):
    # --- Arrange ---
    mock_supabase_instance, _, _, _, _, mock_execute_func = mock_supabase_client_chain
    mock_main_create_supabase_client.return_value = mock_supabase_instance
    mock_execute_func.return_value = MagicMock(data={"data": {"client_name": "Test"}}) # Successful data fetch

    mock_queued_task_id = "queued-task-123"
    mock_update_task_status.return_value = mock_queued_task_id # First call for 'queued'

    mock_runner_instance = MagicMock()
    mock_get_crew_runner.return_value = mock_runner_instance
    
    mock_bg_tasks.add_task.side_effect = Exception("Failed to enqueue")

    request_payload = {"case_id": "test", "operator_instructions": "Test", "template_id": "test.jinja2"}

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 500, response.text
    assert "Failed to enqueue document drafting task: Failed to enqueue" in response.json()["detail"]

    # Check update_task_status was called twice: first for 'queued', then for 'error'
    assert mock_update_task_status.call_count == 2
    mock_update_task_status.assert_any_call( # Check first call (queued)
        task_id=None,
        current_status='queued',
        details=ANY, crew_type=ANY, user_id=ANY, result_data=ANY
    )
    mock_update_task_status.assert_called_with( # Check second call (error)
        task_id=mock_queued_task_id,
        current_status='error',
        details="Failed to enqueue drafting task: Failed to enqueue"
    )


def test_generate_document_invalid_request_body(client_fixture: TestClient): # Renamed client to client_fixture
    # --- Arrange ---
    # Missing 'case_id' which is required
    request_payload = {
        "operator_instructions": "Test instructions",
        "template_id": "some_template.jinja2"
    }

    # --- Act ---
    response = client_fixture.post("/generate-document/", json=request_payload)

    # --- Assert ---
    assert response.status_code == 422 # Unprocessable Entity
    response_json = response.json()
    assert "detail" in response_json
    # Check that the error detail mentions 'case_id' is missing
    assert any("case_id" in error["loc"] and error["type"] == "missing" for error in response_json["detail"])

[end of backend/tests/test_main_generate_document.py]
