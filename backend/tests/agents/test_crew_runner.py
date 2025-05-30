import pytest
import os
from unittest.mock import patch, MagicMock, mock_open

# Import the functions/classes to be tested
from backend.agents.crew_runner import LawFirmCrewRunner, fetch_and_extract_text_from_url

# Import Supabase client for mocking its creation if needed by the tool
from supabase import create_client as actual_create_supabase_client, Client as SupabaseClient


# --- Mocks for external dependencies of crew_runner.py ---

# Mock for requests.get response object
class MockRequestsResponse:
    def __init__(self, content, status_code=200, text=None, headers=None):
        self.content = content
        self.status_code = status_code
        self.text = text if text is not None else (content.decode('utf-8') if isinstance(content, bytes) else content)
        self.headers = headers or {'Content-Type': 'application/octet-stream'}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f"HTTP Error {self.status_code}")

    def __enter__(self): # For use in 'with' statements if needed, though not directly by current code
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


# --- Tests for fetch_and_extract_text_from_url ---

# --- Tests for fetch_and_extract_text_from_url (Updated Signature & Logic) ---

# Helper function to mock parts of the Supabase Admin Client for the tool
def get_mock_supabase_admin_client(signed_url_response=None, signed_url_error=None):
    mock_storage_from = MagicMock()
    if signed_url_error:
        mock_storage_from.create_signed_url.side_effect = signed_url_error
    else:
        # Supabase python client returns a dict like {'signedURL': '...'} or throws error
        # The tool expects to access .get('signedURL')
        mock_storage_from.create_signed_url.return_value = signed_url_response if signed_url_response else {'signedURL': 'mock_signed_url_value'}

    mock_supabase_client_instance = MagicMock(spec=SupabaseClient)
    mock_supabase_client_instance.storage.from_.return_value = mock_storage_from
    return mock_supabase_client_instance

@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client') # Mock the actual create_client from supabase-py
@patch('backend.agents.crew_runner.requests.get')
def test_fetch_successful_signed_url_generation_and_download_pdf(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    # Setup mocks for env variables and Supabase admin client
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://mock-supabase.co', 'SUPABASE_SERVICE_KEY': 'mock-service-key'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client()
    mock_create_admin_client.return_value = mock_admin_client

    # Mock requests.get for the (mocked) signed URL
    mock_pdf_content = b"dummy pdf content for signed url test"
    mock_response_obj = MockRequestsResponse(mock_pdf_content)
    mock_requests_get.return_value = mock_response_obj

    # Mock pypdf
    mock_pdf_page = MagicMock()
    mock_pdf_page.extract_text.return_value = "Signed URL PDF text. "
    mock_pdf_reader_instance = MagicMock()
    mock_pdf_reader_instance.pages = [mock_pdf_page]
    with patch('backend.agents.crew_runner.pypdf.PdfReader', return_value=mock_pdf_reader_instance) as mock_pdf_reader_class:
        result = fetch_and_extract_text_from_url(file_path="path/to/file.pdf", bucket_name="docs", filename="file.pdf")

        assert result == "Signed URL PDF text. "
        mock_os_getenv.assert_any_call("SUPABASE_URL")
        mock_os_getenv.assert_any_call("SUPABASE_SERVICE_KEY")
        mock_create_admin_client.assert_called_once_with('http://mock-supabase.co', 'mock-service-key')
        mock_admin_client.storage.from_('docs').create_signed_url.assert_called_once_with("path/to/file.pdf", 60)
        mock_requests_get.assert_called_once_with('mock_signed_url_value', stream=True, timeout=30)
        mock_pdf_reader_class.assert_called_once()

@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client')
def test_fetch_failure_in_create_signed_url(mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://mock-supabase.co', 'SUPABASE_SERVICE_KEY': 'mock-service-key'}.get(key)
    # Simulate create_signed_url returning an error or unexpected structure
    mock_admin_client = get_mock_supabase_admin_client(signed_url_response={'error': 'Failed to sign', 'signedURL': None})
    mock_create_admin_client.return_value = mock_admin_client

    result = fetch_and_extract_text_from_url(file_path="path/to/file.pdf", bucket_name="docs", filename="file.pdf")
    assert "Error generating signed URL: Failed to sign" in result

@patch('backend.agents.crew_runner.os.getenv', return_value=None) # Mock getenv to return None for all keys
def test_fetch_missing_supabase_credentials_for_tool(mock_os_getenv):
    result = fetch_and_extract_text_from_url(file_path="path/to/file.pdf", bucket_name="docs", filename="file.pdf")
    assert "Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not configured" in result

# Keep existing specific parsing tests, but update them to reflect that the URL to `requests.get`
# is now a (mocked) signed URL, and the primary input to fetch_and_extract_text_from_url has changed.
# For these, we can assume signed URL generation was successful and mock the `requests.get` part.
@patch('backend.agents.crew_runner.os.getenv') # Mock env vars for successful signed URL gen
@patch('backend.agents.crew_runner.create_supabase_client') # Mock admin client for signed URL
@patch('backend.agents.crew_runner.requests.get') # This is the one we test content for
async def test_fetch_pdf_content_after_signed_url(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://m', 'SUPABASE_SERVICE_KEY': 'k'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client() # Default success for signed URL
    mock_create_admin_client.return_value = mock_admin_client

    mock_pdf_page = MagicMock()
    mock_pdf_page.extract_text.return_value = "PDF content. "
    mock_pdf_reader_instance = MagicMock()
    mock_pdf_reader_instance.pages = [mock_pdf_page]
    with patch('backend.agents.crew_runner.pypdf.PdfReader', return_value=mock_pdf_reader_instance) as mock_pdf_reader_class:
        mock_response = MockRequestsResponse(b"dummy pdf data")
        mock_requests_get.return_value = mock_response

        result = fetch_and_extract_text_from_url("path/to/doc.pdf", "docs", "doc.pdf")
        assert result == "PDF content. "
        mock_requests_get.assert_called_once_with('mock_signed_url_value', stream=True, timeout=30)

# Similar updates for test_fetch_docx_success, test_fetch_txt_success, test_fetch_unsupported_type,
# test_fetch_network_error (now testing network error on signed URL), test_fetch_pdf_parsing_error

@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client')
@patch('backend.agents.crew_runner.requests.get')
def test_fetch_docx_content_after_signed_url(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://m', 'SUPABASE_SERVICE_KEY': 'k'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client()
    mock_create_admin_client.return_value = mock_admin_client

    mock_paragraph = MagicMock()
    mock_paragraph.text = "Docx paragraph."
    mock_docx_instance = MagicMock()
    mock_docx_instance.paragraphs = [mock_paragraph]
    with patch('backend.agents.crew_runner.docx.Document', return_value=mock_docx_instance) as mock_docx_class:
        mock_response = MockRequestsResponse(b"dummy docx data")
        mock_requests_get.return_value = mock_response
        result = fetch_and_extract_text_from_url("path/to/doc.docx", "docs", "doc.docx")
        assert result == "Docx paragraph.\n"
        mock_requests_get.assert_called_with('mock_signed_url_value', stream=True, timeout=30)

@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client')
@patch('backend.agents.crew_runner.requests.get')
def test_fetch_txt_content_after_signed_url(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://m', 'SUPABASE_SERVICE_KEY': 'k'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client()
    mock_create_admin_client.return_value = mock_admin_client

    mock_response = MockRequestsResponse(b"Txt content", text="Txt content")
    mock_requests_get.return_value = mock_response
    result = fetch_and_extract_text_from_url("path/to/doc.txt", "docs", "doc.txt")
    assert result == "Txt content"
    mock_requests_get.assert_called_with('mock_signed_url_value', stream=True, timeout=30)

@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client')
@patch('backend.agents.crew_runner.requests.get')
def test_fetch_unsupported_type_after_signed_url(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://m', 'SUPABASE_SERVICE_KEY': 'k'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client()
    mock_create_admin_client.return_value = mock_admin_client

    mock_response = MockRequestsResponse(b"dummy data")
    mock_requests_get.return_value = mock_response
    result = fetch_and_extract_text_from_url("path/to/doc.xlsx", "docs", "doc.xlsx")
    assert "Text extraction not supported for this file type: '.xlsx'" in result
    # requests.get is still called with the signed URL, but then type is checked
    mock_requests_get.assert_called_with('mock_signed_url_value', stream=True, timeout=30)


@patch('backend.agents.crew_runner.os.getenv')
@patch('backend.agents.crew_runner.create_supabase_client')
@patch('backend.agents.crew_runner.requests.get')
def test_fetch_network_error_on_signed_url(mock_requests_get, mock_create_admin_client, mock_os_getenv):
    mock_os_getenv.side_effect = lambda key: {'SUPABASE_URL': 'http://m', 'SUPABASE_SERVICE_KEY': 'k'}.get(key)
    mock_admin_client = get_mock_supabase_admin_client()
    mock_create_admin_client.return_value = mock_admin_client

    mock_requests_get.side_effect = requests.exceptions.RequestException("Signed URL timeout")
    result = fetch_and_extract_text_from_url("path/to/doc.pdf", "docs", "doc.pdf")
    assert "Error fetching file from generated signed URL 'mock_signed_url_value': Signed URL timeout" in result


# --- Tests for LawFirmCrewRunner.run_crew method ---
# These will be more involved and require mocking ChatOpenAI, Crew, Task, Agent, and update_task_status

@pytest.fixture
def mock_env_openai_key(monkeypatch):
    """Fixture to mock the OPENAI_API_KEY environment variable."""
    monkeypatch.setenv("OPENAI_API_KEY", "test_api_key")

@pytest.fixture
def mock_env_no_openai_key(monkeypatch):
    """Fixture to ensure OPENAI_API_KEY is not set."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

# Mock for update_task_status
@patch('backend.agents.crew_runner.update_task_status', MagicMock(return_value="mock-task-id"))
def test_run_crew_llm_disabled_success(mock_env_no_openai_key): # Use fixture to unset API key
    runner = LawFirmCrewRunner() # LLM should be None
    assert runner.llm is None

    # Updated sample_doc_info to reflect new structure
    sample_doc_info = {
        "filename": "sample.txt",
        "file_path": "path/to/sample.txt",
        "bucket_name": "docs"
    }

    # run_crew uses the mock outputs directly when self.llm is None
    # The mock_extracted_text in run_crew's LLM disabled path needs to be updated for file_path
    result = runner.run_crew(document_info=sample_doc_info, user_query="Test query")

    assert result["status"] == "success"
    assert result["task_id"] == "mock-task-id" # Assuming first call to update_task_status generates the main ID

    # Check that the mock result (which is a JSON string) contains expected mock task definitions
    assert "Mock Task 1: Review Document" in result["results"]
    assert "mock summary of 'sample.txt'" in result["results"] # This check is a bit weak as actual_crew_result is from task_def_task
                                                              # and the parsing_task result is not directly in final output.
                                                              # The mock flow directly sets actual_crew_result to task_def_task's output.

    # Verify update_task_status calls (at least the sequence)
    # The mock is global, so we need to check its call history or reset it if more granularity is needed.
    # For now, this is a basic check that it ran.
    assert backend.agents.crew_runner.update_task_status.call_count >= 3 # pending, in_progress, completed


@patch('backend.agents.crew_runner.update_task_status', MagicMock(return_value="mock-task-id"))
@patch('backend.agents.crew_runner.ChatOpenAI') # Mock the LLM
@patch('backend.agents.crew_runner.Crew') # Mock Crew
def test_run_crew_llm_enabled_tool_success(mock_crew_class, mock_chat_openai_class, mock_env_openai_key):
    # Ensure LLM is attempted to be initialized (mock_env_openai_key sets the key)
    mock_chat_openai_instance = MagicMock()
    mock_chat_openai_class.return_value = mock_chat_openai_instance

    # Mock the crew instance and its kickoff method
    mock_crew_instance = MagicMock()
    mock_crew_instance.kickoff.return_value = {"summary": "LLM summary based on extracted text.", "defined_tasks": []} # Output of last agent

    # Mock the output of the first task (parsing_task) to simulate successful tool use by the agent
    mock_parsing_task_output_obj = MagicMock()
    mock_parsing_task_output_obj.raw_output = '{"extracted_text": "Successfully extracted text from document.", "summary": "Brief summary of successfully extracted text."}'
    mock_crew_instance.tasks = [MagicMock(output=mock_parsing_task_output_obj)] # Make tasks[0] accessible

    mock_crew_class.return_value = mock_crew_instance

    runner = LawFirmCrewRunner() # LLM should be mocked ChatOpenAI instance
    assert runner.llm is mock_chat_openai_instance

    # Updated sample_doc_info for new structure
    sample_doc_info = {
        "filename": "remote_doc.pdf",
        "file_path": "path/to/remote_doc.pdf",
        "bucket_name": "docs",
        "extracted_text": None # Force tool use
    }

    result = runner.run_crew(document_info=sample_doc_info, user_query="Summarize.")

    assert result["status"] == "success"
    assert result["task_id"] == "mock-task-id"
    # Check that kickoff was called with inputs that would require tool use
    mock_crew_instance.kickoff.assert_called_once_with(inputs={
        'file_path': sample_doc_info['file_path'],
        'bucket_name': sample_doc_info['bucket_name'],
        'filename': sample_doc_info['filename'],
        'user_query': "Summarize.",
        'document_text_content': None
    })
    # Check the details passed to the final 'completed' status update
    final_status_call_args = backend.agents.crew_runner.update_task_status.call_args_list[-1] # Get last call
    assert final_status_call_args[0][1] == 'completed' # Status
    assert "Successfully extracted text" in final_status_call_args[1]['details']['parsing_task_output']['extracted_text']


@patch('backend.agents.crew_runner.update_task_status', MagicMock(return_value="mock-task-id-extraction-fail"))
@patch('backend.agents.crew_runner.ChatOpenAI')
@patch('backend.agents.crew_runner.Crew')
def test_run_crew_text_extraction_failure(mock_crew_class, mock_chat_openai_class, mock_env_openai_key):
    mock_chat_openai_instance = MagicMock()
    mock_chat_openai_class.return_value = mock_chat_openai_instance

    mock_crew_instance = MagicMock()
    # Simulate that the TaskDefinitionAgent still produces some output, perhaps noting the failure
    mock_crew_instance.kickoff.return_value = {"summary": "Could not process document fully.", "defined_tasks": [{"name": "Inform user of failure"}]}

    # THIS IS CRUCIAL: Mock the output of parsing_task to show an error from the tool
    mock_parsing_task_output_obj = MagicMock()
    mock_parsing_task_output_obj.raw_output = '{"extracted_text": "Text extraction not supported for this file type: \'.zip\'", "summary": "Document could not be processed: unsupported file type."}'
    mock_crew_instance.tasks = [MagicMock(output=mock_parsing_task_output_obj)]

    mock_crew_class.return_value = mock_crew_instance

    runner = LawFirmCrewRunner()
    # Updated sample_doc_info
    sample_doc_info = {
        "filename": "unsupported.zip",
        "file_path": "path/to/unsupported.zip",
        "bucket_name": "docs",
        "extracted_text": None
    }

    result = runner.run_crew(document_info=sample_doc_info, user_query="Process this.")

    assert result["status"] == "success_with_issues"
    assert result["task_id"] == "mock-task-id-extraction-fail"
    assert result["results"]["text_extraction_status"] == "failed"
    assert "Text extraction not supported" in result["results"]["text_extraction_detail"]

    # Check that update_task_status was called with 'completed_with_issues'
    final_status_call_args = backend.agents.crew_runner.update_task_status.call_args_list[-1]
    assert final_status_call_args[0][1] == 'completed_with_issues'


@patch('backend.agents.crew_runner.update_task_status', MagicMock(return_value="mock-task-id-crew-fail"))
@patch('backend.agents.crew_runner.ChatOpenAI')
@patch('backend.agents.crew_runner.Crew') # Mock Crew itself
def test_run_crew_kickoff_exception(mock_crew_class, mock_chat_openai_class, mock_env_openai_key):
    mock_chat_openai_instance = MagicMock()
    mock_chat_openai_class.return_value = mock_chat_openai_instance

    mock_crew_instance = MagicMock()
    mock_crew_instance.kickoff.side_effect = Exception("Major crew failure!") # Simulate kickoff raising an error
    mock_crew_class.return_value = mock_crew_instance

    runner = LawFirmCrewRunner()
    # Updated sample_doc_info
    sample_doc_info = {
        "filename": "anyfile.pdf",
        "file_path": "path/to/anyfile.pdf",
        "bucket_name": "docs"
    }

    result = runner.run_crew(document_info=sample_doc_info, user_query="Process.")

    assert result["status"] == "error"
    assert result["task_id"] == "mock-task-id-crew-fail" # This is the ID from the initial 'pending' status update
    assert "Major crew failure!" in result["message"]

    # Check that update_task_status was called with 'error'
    error_status_call_args = backend.agents.crew_runner.update_task_status.call_args_list[-1]
    assert error_status_call_args[0][1] == 'error'
    assert "Major crew failure!" in error_status_call_args[1]['details']['error_details']


# Note: Need to import 'requests' for requests.exceptions.RequestException in test_fetch_network_error
# and 'pypdf' for pypdf.errors.PdfReadError in test_fetch_pdf_parsing_error.
# This is implicitly handled by them being in crew_runner.py but good to be aware.
# Also need to import 'backend.agents.crew_runner' for the update_task_status mock path.
import requests # For requests.exceptions.RequestException
import pypdf # For pypdf.errors.PdfReadError
import backend.agents.crew_runner # For patching update_task_status correctly
