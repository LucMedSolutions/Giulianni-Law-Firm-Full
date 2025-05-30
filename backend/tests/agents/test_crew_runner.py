import pytest
import os
from unittest.mock import patch, MagicMock, mock_open

# Import the functions/classes to be tested
from backend.agents.crew_runner import LawFirmCrewRunner, fetch_and_extract_text_from_url

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

@pytest.mark.asyncio # Though the function itself is sync, tests using it with async fixtures might need this
@patch('backend.agents.crew_runner.requests.get')
async def test_fetch_pdf_success(mock_requests_get):
    # Mock pypdf.PdfReader and its methods
    mock_pdf_page = MagicMock()
    mock_pdf_page.extract_text.return_value = "This is page text. "
    mock_pdf_reader_instance = MagicMock()
    mock_pdf_reader_instance.pages = [mock_pdf_page, mock_pdf_page] # Simulate 2 pages

    with patch('backend.agents.crew_runner.pypdf.PdfReader', return_value=mock_pdf_reader_instance) as mock_pdf_reader_class:
        # Mock requests.get to return PDF-like content (bytes)
        mock_response = MockRequestsResponse(b"dummy pdf content")
        mock_requests_get.return_value = mock_response

        result = fetch_and_extract_text_from_url("http://example.com/test.pdf", "test.pdf")

        assert result == "This is page text. This is page text. "
        mock_requests_get.assert_called_once_with("http://example.com/test.pdf", stream=True, timeout=30)
        mock_pdf_reader_class.assert_called_once() # Check PdfReader was instantiated

@patch('backend.agents.crew_runner.requests.get')
def test_fetch_docx_success(mock_requests_get):
    # Mock docx.Document and its methods/properties
    mock_paragraph = MagicMock()
    mock_paragraph.text = "This is a docx paragraph."
    mock_docx_document_instance = MagicMock()
    mock_docx_document_instance.paragraphs = [mock_paragraph, mock_paragraph] # Simulate 2 paragraphs

    with patch('backend.agents.crew_runner.docx.Document', return_value=mock_docx_document_instance) as mock_docx_document_class:
        mock_response = MockRequestsResponse(b"dummy docx content")
        mock_requests_get.return_value = mock_response

        result = fetch_and_extract_text_from_url("http://example.com/test.docx", "test.docx")

        assert result == "This is a docx paragraph.\nThis is a docx paragraph.\n"
        mock_requests_get.assert_called_once_with("http://example.com/test.docx", stream=True, timeout=30)
        mock_docx_document_class.assert_called_once()

@patch('backend.agents.crew_runner.requests.get')
def test_fetch_txt_success(mock_requests_get):
    mock_response = MockRequestsResponse(b"Hello, world!", text="Hello, world!")
    mock_requests_get.return_value = mock_response

    result = fetch_and_extract_text_from_url("http://example.com/test.txt", "test.txt")

    assert result == "Hello, world!"
    mock_requests_get.assert_called_once_with("http://example.com/test.txt", stream=True, timeout=30)

@patch('backend.agents.crew_runner.requests.get')
def test_fetch_unsupported_type(mock_requests_get):
    # No need to mock response content as it shouldn't be read for unsupported type
    mock_response = MockRequestsResponse(b"dummy content")
    mock_requests_get.return_value = mock_response

    result = fetch_and_extract_text_from_url("http://example.com/test.xlsx", "test.xlsx")

    assert "Text extraction not supported for this file type: '.xlsx'" in result
    mock_requests_get.assert_called_once_with("http://example.com/test.xlsx", stream=True, timeout=30)

@patch('backend.agents.crew_runner.requests.get')
def test_fetch_network_error(mock_requests_get):
    # Simulate a requests.exceptions.RequestException (e.g., network error)
    mock_requests_get.side_effect = requests.exceptions.RequestException("Network timeout")

    result = fetch_and_extract_text_from_url("http://example.com/test.pdf", "test.pdf")

    assert "Error fetching file from URL 'http://example.com/test.pdf': Network timeout" in result
    mock_requests_get.assert_called_once_with("http://example.com/test.pdf", stream=True, timeout=30)

@patch('backend.agents.crew_runner.requests.get')
@patch('backend.agents.crew_runner.pypdf.PdfReader') # Mock the PdfReader class
def test_fetch_pdf_parsing_error(mock_pdf_reader_class, mock_requests_get):
    # Mock requests.get to return some content
    mock_response = MockRequestsResponse(b"corrupted pdf content")
    mock_requests_get.return_value = mock_response

    # Simulate PdfReader raising an error (e.g., pypdf.errors.PdfReadError)
    mock_pdf_reader_class.side_effect = pypdf.errors.PdfReadError("Corrupted PDF")

    result = fetch_and_extract_text_from_url("http://example.com/corrupted.pdf", "corrupted.pdf")

    assert "Error parsing PDF 'corrupted.pdf': Corrupted PDF" in result
    mock_requests_get.assert_called_once_with("http://example.com/corrupted.pdf", stream=True, timeout=30)
    mock_pdf_reader_class.assert_called_once() # Ensure PdfReader was attempted


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

    sample_doc_info = {"filename": "sample.txt", "file_url": "http://example.com/sample.txt"}

    # run_crew uses the mock outputs directly when self.llm is None
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

    sample_doc_info = {"filename": "remote_doc.pdf", "file_url": "http://example.com/remote_doc.pdf", "extracted_text": None} # Force tool use

    result = runner.run_crew(document_info=sample_doc_info, user_query="Summarize.")

    assert result["status"] == "success"
    assert result["task_id"] == "mock-task-id"
    # Check that kickoff was called with inputs that would require tool use
    mock_crew_instance.kickoff.assert_called_once_with(inputs={
        'file_url': sample_doc_info['file_url'],
        'filename': sample_doc_info['filename'],
        'user_query': "Summarize.",
        'document_text_content': None # Explicitly None to trigger tool
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
    sample_doc_info = {"filename": "unsupported.zip", "file_url": "http://example.com/unsupported.zip", "extracted_text": None}

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
    sample_doc_info = {"filename": "anyfile.pdf", "file_url": "http://example.com/anyfile.pdf"}

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
