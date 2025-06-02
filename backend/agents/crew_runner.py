# backend/agents/crew_runner.py
# This module is responsible for managing the execution of Crew AI agents.
# It defines the agents, tasks, and the overall crew that processes documents.
import os
import uuid # Standard library for generating unique IDs
import json # For handling JSON strings, especially from LLM outputs
from textwrap import dedent # For cleaner multi-line string definitions (e.g., backstories)
import io # For handling byte streams for file processing
import datetime # For generating timestamps, e.g., for 'generation_date'
import jinja2 # For document templating

# Third-party libraries for file processing
import requests
import pypdf
import docx # python-docx library

from crewai import Agent, Task, Crew, Process # Core Crew AI components
from langchain_openai import ChatOpenAI # Specific LLM implementation from Langchain
from langchain.tools import tool # For creating tools from functions

# Local imports for status tracking
from backend.agents.status import update_task_status, get_agent_status
from supabase import create_client as create_supabase_client, Client as SupabaseClient

# Note: generate_legal_tasks from task_generator.py is no longer directly used here.

# --- File Processing Tool Definition ---
@tool("document_content_fetcher_tool")
def fetch_and_extract_text_from_url(file_path: str, bucket_name: str, filename: str) -> str:
    """
    Generates a signed URL for a document in Supabase Storage, fetches it, and extracts its text content.
    Supports PDF (.pdf), Word (.docx), and plain text (.txt) files.
    'file_path', 'bucket_name', and 'filename' are used to locate and process the file.
    Returns the extracted text or an error message if extraction fails or the type is unsupported.
    Requires SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables for admin client.
    """
    print(f"Tool: Attempting to process file: {filename}, Path: {file_path}, Bucket: {bucket_name}")

    signed_file_url = ""
    try:
        # Initialize Supabase admin client to generate signed URL
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

        if not supabase_url or not supabase_service_key:
            return "Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not configured for the tool."

        supabase_admin: SupabaseClient = create_supabase_client(supabase_url, supabase_service_key)

        signed_url_response = supabase_admin.storage.from_(bucket_name).create_signed_url(file_path, 60) # 60 seconds expiry
        signed_file_url = signed_url_response.get('signedURL') # Corrected key access
        if not signed_file_url:
             # Check if there's an error in the response if signedURL is not found
            error_detail = signed_url_response.get('error', 'Unknown error generating signed URL')
            return f"Error generating signed URL: {error_detail}. Path: {file_path}, Bucket: {bucket_name}"


        print(f"Tool: Generated signed URL: {signed_file_url} for file: {filename}")

        response = requests.get(signed_file_url, stream=True, timeout=30)
        response.raise_for_status()

        extension = os.path.splitext(filename)[1].lower()
        extracted_text = ""

        if extension == '.pdf':
            bytes_io = io.BytesIO(response.content)
            pdf_reader = pypdf.PdfReader(bytes_io)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                extracted_text += page.extract_text() or "" # Add empty string if None
            if not extracted_text:
                return f"Text extraction from PDF '{filename}' resulted in empty content. The PDF might be image-based or password-protected."
            print(f"Tool: Successfully extracted text from PDF: {filename}")
            return extracted_text

        elif extension == '.docx':
            bytes_io = io.BytesIO(response.content)
            document = docx.Document(bytes_io)
            for para in document.paragraphs:
                extracted_text += para.text + "\n"
            if not extracted_text:
                 return f"Text extraction from DOCX '{filename}' resulted in empty content."
            print(f"Tool: Successfully extracted text from DOCX: {filename}")
            return extracted_text

        elif extension == '.txt':
            # Assuming UTF-8 encoding, which is common.
            # response.text will decode based on Content-Type header or default to ISO-8859-1 if not specified.
            # For more robust TXT handling, consider chardet or specifying encoding.
            extracted_text = response.text
            if not extracted_text:
                return f"Text extraction from TXT '{filename}' resulted in empty content."
            print(f"Tool: Successfully extracted text from TXT: {filename}")
            return extracted_text

        else:
            unsupported_msg = f"Text extraction not supported for this file type: '{extension}' (Filename: {filename}). Signed URL was: {signed_file_url}"
            print(f"Tool: {unsupported_msg}")
            return unsupported_msg

    except requests.exceptions.RequestException as e:
        error_msg = f"Error fetching file from generated signed URL '{signed_file_url}': {str(e)}"
        print(f"Tool: {error_msg}")
        return error_msg
    except pypdf.errors.PdfReadError as e:
        error_msg = f"Error parsing PDF '{filename}' (from signed URL '{signed_file_url}'): {str(e)}. The file might be corrupted or password-protected."
        print(f"Tool: {error_msg}")
        return error_msg
    except Exception as e: # Catch other potential errors during parsing (e.g., from python-docx)
        error_msg = f"Error processing file '{filename}' (type: '{extension}'): {str(e)}"
        print(f"Tool: {error_msg}")
        return error_msg
# --- End File Processing Tool Definition ---


class LawFirmCrewRunner:
    """
    Manages the setup and execution of a Crew AI workflow for legal document analysis.
    This class initializes agents, defines tasks, and runs the crew, handling both
    LLM-powered execution and mock fallbacks if an LLM is not available.
    """
    def __init__(self, task_id: str = None):
        """
        Initializes the LawFirmCrewRunner.
        - Sets up the main task ID for tracking.
        - Attempts to initialize an LLM (currently OpenAI's ChatOpenAI).
        - Defines agents (DocumentParserAgent, TaskDefinitionAgent) with or without the LLM.

        Args:
            task_id (str, optional): An existing task ID if this runner is part of a larger process. Defaults to None.
        """
        self.main_task_id = task_id  # Stores the overall task_id for the entire crew run.
        self.llm = None # Will hold the LLM instance if successfully initialized.

        # Attempt to load OpenAI API key and initialize the LLM.
        # This is crucial for the agents to perform their tasks using real AI capabilities.
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            print("CrewRunner: OpenAI API key found. Initializing LLM.")
            try:
                # Initialize ChatOpenAI with specific parameters.
                # Model name is configurable via environment variable.
                # Temperature is set to 0.2 for more deterministic and less "creative" outputs.
                default_model = os.getenv("OPENAI_DEFAULT_MODEL", "gpt-4o")
                print(f"CrewRunner: Using OpenAI model: {default_model}")
                self.llm = ChatOpenAI(api_key=openai_api_key, temperature=0.2, model_name=default_model)
            except Exception as e:
                # If LLM initialization fails, log the error and ensure self.llm is None.
                print(f"CrewRunner: Error initializing OpenAI LLM: {e}. Real LLM capabilities will be disabled.")
                self.llm = None
        else:
            # If the API key is not found, AI capabilities are disabled, and mock responses will be used.
            print("CrewRunner: Warning: OPENAI_API_KEY not found. Real LLM capabilities will be disabled. Using mock responses.")

        # Common arguments for agent initialization.
        # 'verbose': True enables detailed logging from the agents.
        # 'allow_delegation': False means agents cannot delegate tasks to other agents (simplifies flow for now).
        # 'llm': Assigns the initialized LLM, or None if it wasn't set up (agents will use mock logic if llm is None).
        common_agent_args = {
            "verbose": True,
            "allow_delegation": False,
            "llm": self.llm, 
        }

        # Agent for parsing and summarizing documents.
        # This agent now has access to the document_content_fetcher_tool.
        self.document_parser_agent = Agent(
            role='DocumentParserAgent',
            goal=dedent("""\
                Parse and extract key information and a summary from documents.
                If 'document_text_content' is directly provided in your input, use that as the document's text.
                Otherwise, you MUST use the 'document_content_fetcher_tool' with the 'file_path', 'bucket_name', and 'filename'
                (from your input) to fetch and extract the document's text content.
                If the tool returns an error message (e.g., config error, signed URL error, unsupported file type, fetch error, parsing error),
                that error message should be used as the 'extracted_text' in your output.
                Finally, provide a concise summary of the (potentially error) 'extracted_text' (approx. 150-200 words).
                If summarizing an error message, the summary should state that the document could not be processed and why."""),
            backstory=dedent("""A specialized agent for dissecting document content. 
            It focuses on extracting the full text using available tools if necessary,
            and then creating a concise summary of the content or any processing errors."""),
            tools=[fetch_and_extract_text_from_url], # Assign the new tool
            **common_agent_args
        )

        # Agent for defining subsequent tasks based on the parsed document and user query.
        self.task_definition_agent = Agent(
            role='TaskDefinitionAgent',
            goal='Define specific, actionable tasks based on document content and user queries. Output should be a JSON list of task definitions.',
            backstory=dedent("""An analytical agent skilled in breaking down complex requests and document content 
            into actionable, well-defined tasks for other specialized agents. It ensures tasks are clear and targeted."""),
            # This agent relies on the output of the DocumentParserAgent.
            **common_agent_args
        )

        # Agent for drafting documents from templates.
        self.document_drafter_agent = Agent(
            role='DocumentDrafterAgent',
            goal=dedent("""\
                Generate a document by filling a specified Jinja2 template with provided structured client data and operator instructions.
                Focus on accurately populating the template based on the inputs.
                The final output should ONLY be the populated template content. Do not add any extra commentary."""),
            backstory=dedent("""A meticulous agent specializing in document generation. 
            It takes structured data, operator guidelines, and a template, then precisely assembles the final document."""),
            # This agent primarily uses the LLM's understanding to fill the template based on the prompt.
            # No specific external tools are assigned here, but it can use self.llm.
            **common_agent_args
        )
        
        # Initialize Supabase client for internal use (e.g., by document_content_fetcher_tool and drafting crew)
        # This avoids re-initializing it multiple times if multiple methods need it.
        self.supabase_client: SupabaseClient = None
        _supabase_url = os.getenv("SUPABASE_URL")
        _supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")
        if _supabase_url and _supabase_service_key:
            try:
                self.supabase_client = create_supabase_client(_supabase_url, _supabase_service_key)
                print("CrewRunner: Supabase client initialized for internal operations.")
            except Exception as e:
                print(f"CrewRunner: Error initializing internal Supabase client: {e}")
        else:
            print("CrewRunner: Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Internal Supabase operations will fail.")


    def _load_template(self, template_id: str) -> str | None:
        """
        Loads a Jinja2 template from the backend/templates directory.
        Args:
            template_id (str): The filename of the template (e.g., 'nda_template.jinja2').
        Returns:
            str: The content of the template file, or None if an error occurs.
        """
        try:
            # Assuming this script is in backend/agents/ and templates are in backend/templates/
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Moves up to backend/
            template_path = os.path.join(base_dir, 'templates', template_id)
            
            print(f"CrewRunner: Attempting to load template from: {template_path}")
            with open(template_path, 'r', encoding='utf-8') as f:
                template_content = f.read()
            print(f"CrewRunner: Template '{template_id}' loaded successfully.")
            return template_content
        except FileNotFoundError:
            print(f"CrewRunner: Error - Template file not found: {template_path}")
            return None
        except Exception as e:
            print(f"CrewRunner: Error loading template '{template_id}': {e}")
            return None

    def run_crew(self, task_id_from_endpoint: str, document_info: dict, user_query: str = None):
        """
        Runs the document parsing and task definition crew. This involves:
        1. Using the provided task_id_from_endpoint for status tracking.
        2. Defining tasks for document parsing and subsequent task definition.
        3. Executing these tasks using the configured Crew (either with a real LLM or mock fallbacks).
        4. Updating the status of the main task ID throughout the process.

        Args:
            task_id_from_endpoint (str): The task ID generated by the endpoint, used for status tracking.
            document_info (dict): Information about the document, potentially including
                                  'file_path', 'bucket_name', 'filename', and 'extracted_text'.
            user_query (str, optional): A specific query from the user regarding the document.

        Returns:
            dict: A dictionary containing the status of the crew run ('success' or 'error'),
                  the main_task_id, and the results (either from LLM or mock).
        """
        self.main_task_id = task_id_from_endpoint
        print(f"CrewRunner: Received Task ID for this run: {self.main_task_id}")
        
        filename = document_info.get("filename", "N/A")
        # file_url is no longer passed directly from main.py, tool will generate it from file_path and bucket_name
        file_path = document_info.get("file_path", "N/A")
        bucket_name = document_info.get("bucket_name", "N/A")
        doc_text_content = document_info.get("extracted_text") # For potentially pre-extracted text

        print(f"CrewRunner: Processing document '{filename}' from path '{file_path}' in bucket '{bucket_name}'.")
        
        # Log if pre-extracted text is missing, agent will use the tool.
        if not doc_text_content and self.llm:
            print(f"CrewRunner: No pre-extracted text for {filename}. DocumentParserAgent will use the tool.")

        actual_crew_result = None # To store the final output from the crew.

        try:
            # Update status: AI processing (document parsing and summarization) starts.
            # crew_type and user_id would have been set when the task was initially queued from the endpoint.
            update_task_status(
                task_id=self.main_task_id,
                current_status='in_progress',
                details=f'AI processing started for document: {filename}'
            )

            # --- Define Parsing Task ---
            # This task is handled by the DocumentParserAgent.
            # Its goal is to extract text (if not provided) and summarize it.
            parsing_task_desc = dedent(f"""\
                Analyze the document named '{filename}'.
                You are given its 'file_path': '{file_path}' and 'bucket_name': '{bucket_name}'.
                Your primary goal is to obtain the text content of this document.

                Instructions:
                1. Check if 'document_text_content' is already provided in your input.
                   - If YES: Use this text directly for the next step.
                   - If NO: You MUST use the 'document_content_fetcher_tool'. Provide it with the 'file_path' ('{file_path}'), 'bucket_name' ('{bucket_name}'), and 'filename' ('{filename}') from your input to get the text.

                2. Once you have the text (either provided directly or fetched by the tool):
                   - This text (or any error message from the tool if fetching failed) will be the 'extracted_text'.
                   - Generate a concise summary of this 'extracted_text' (approx. 150-200 words).
                   - If 'extracted_text' is an error message (e.g., "Text extraction not supported..."), your summary should reflect that the document could not be processed and briefly state the reason.
            """)
            
            parsing_task = Task(
                description=parsing_task_desc,
                expected_output=dedent("""\
                    A JSON object containing two keys:
                    1. "extracted_text": A string containing the full text of the document, or an error message if text extraction failed (e.g., "Text extraction not supported for .xlsx files", "Error fetching file from URL...").
                    2. "summary": A string containing a concise summary (150-200 words) of the "extracted_text". If "extracted_text" is an error message, the summary should indicate that processing failed and why.
                    Example for successful extraction:
                    {
                        "extracted_text": "The full text of the document...",
                        "summary": "This document discusses..."
                    }
                    Example for a failed extraction (e.g. unsupported type):
                    {
                        "extracted_text": "Text extraction not supported for this file type: '.xlsx' (Filename: data.xlsx).",
                        "summary": "The document 'data.xlsx' could not be processed because its file type (.xlsx) is not supported for text extraction."
                    }
                    Example for a failed fetch:
                    {
                        "extracted_text": "Error fetching file from URL 'http://example.com/missing.pdf': 404 Client Error: Not Found for url: http://example.com/missing.pdf",
                        "summary": "The document 'missing.pdf' could not be processed because it could not be fetched from the provided URL (404 Not Found)."
                    }
                """),
                agent=self.document_parser_agent,
                async_execution=False # Run tasks sequentially for now.
            )

            # --- Define Task Definition Task ---
            # This task is handled by the TaskDefinitionAgent.
            # It takes the output of the parsing_task and the user_query to define follow-up tasks.
            task_def_task_desc = (
                'Given the document summary and extracted text from the previous task, and the user query, '
                f'define 2-3 specific, actionable follow-up tasks. The user query is: "{user_query if user_query else "No specific query provided, perform general analysis."}"'
            )
            task_def_task = Task(
                description=task_def_task_desc,
                expected_output='A JSON list of task definition objects. Each object should have "name" (string, concise), "description" (string, detailed), "agent_role_suggestion" (string, e.g., "LegalAnalysisAgent"), and "expected_output_format" (string, e.g., "A bullet-point list of key findings.") keys.',
                agent=self.task_definition_agent,
                context=[parsing_task], # This task depends on the output of parsing_task.
                async_execution=False
            )

            # --- Setup and Run Crew ---
            crew = Crew(
                agents=[self.document_parser_agent, self.task_definition_agent],
                tasks=[parsing_task, task_def_task],
                process=Process.sequential, # Tasks will run one after another.
                verbose=2 # Higher verbosity for more detailed logs from Crew AI.
            )

            if self.llm:
                # LLM is available: Run the crew with real AI capabilities.
                print(f"CrewRunner: Kicking off LLM-powered crew for Task ID: {self.main_task_id}")
                # Inputs for the kickoff are available to all tasks in the crew.
                # 'document_text_content' allows passing pre-extracted text directly.
                kickoff_inputs = {
                    'file_path': file_path,
                    'bucket_name': bucket_name,
                    'filename': filename,
                    'user_query': user_query or "", 
                    'document_text_content': doc_text_content or ""
                }
                actual_crew_result = crew.kickoff(inputs=kickoff_inputs)
                
                # Update status: Follow-up task generation (second step of the crew) is in progress.
                # No need to change this update_task_status call as it's just detailing the current step.
                update_task_status(
                    task_id=self.main_task_id, 
                    current_status='in_progress', 
                    details='Generating follow-up tasks using LLM...'
                )
                print(f"CrewRunner: LLM-powered crew finished for Task ID: {self.main_task_id}. Result: {actual_crew_result}")

            else: 
                # LLM is NOT available: Fallback to mock execution.
                # This ensures the system can run end-to-end for testing or when API keys are missing.
                print(f"CrewRunner: LLM not available. Running mock crew for Task ID: {self.main_task_id}")
                
                # Simulate output for parsing_task.
                # Note: In the mock path, the tool is not actually called, so we simulate based on whether doc_text_content was provided.
                mock_extracted_text = doc_text_content if doc_text_content else f"This is MOCK extracted text for '{filename}'. (File path: {file_path}, Bucket: {bucket_name}). Tool not used in mock LLM-disabled mode."
                mock_summary = f"This is a MOCK summary for '{filename}'. It highlights key MOCK points of the document."
                mock_parsing_output_str = json.dumps({ 
                    "extracted_text": mock_extracted_text,
                    "summary": mock_summary
                })
                print(f"CrewRunner: Mock parsing_task output: {mock_parsing_output_str}")
                # In a real sequential execution, this output would be passed to the next task.
                # The Crew AI framework handles this. For mock, we just log it.
                
                # Update status for mock follow-up task generation.
                update_task_status(
                    task_id=self.main_task_id,
                    current_status='in_progress', 
                    details='Generating mock follow-up tasks...'
                )
                
                # Simulate output for task_def_task.
                mock_task_definitions = [
                    {
                        "name": "Mock Task 1: Review Document",
                        "description": f"Based on the mock summary of '{filename}', review its (mock) contents for general understanding.",
                        "agent_role_suggestion": "GeneralReviewAgent",
                        "expected_output_format": "A brief confirmation of review."
                    },
                    {
                        "name": "Mock Task 2: Address User Query (Mock)",
                        "description": f"Address the user query: '{user_query if user_query else "No query provided."}' using the mock document content.",
                        "agent_role_suggestion": "QueryResolutionAgent",
                        "expected_output_format": "A mock answer to the query."
                    }
                ]
                actual_crew_result = json.dumps(mock_task_definitions) # Result is a JSON string.
                print(f"CrewRunner: Mock task_def_task output: {actual_crew_result}")

            # --- Process Crew Results and Handle Potential Extraction Errors ---
            final_status_details = {"crew_output": actual_crew_result}
            parsing_task_output_str = crew.tasks[0].output.raw_output if crew.tasks and crew.tasks[0].output else None

            if parsing_task_output_str:
                try:
                    parsing_result = json.loads(parsing_task_output_str)
                    final_status_details["parsing_task_output"] = parsing_result

                    extracted_text_from_parser = parsing_result.get("extracted_text", "")
                    # Check for known error strings from the fetch_and_extract_text_from_url tool or empty results
                    if not extracted_text_from_parser or \
                       "Error fetching file" in extracted_text_from_parser or \
                       "Text extraction not supported" in extracted_text_from_parser or \
                       "Error parsing" in extracted_text_from_parser or \
                       "resulted in empty content" in extracted_text_from_parser:

                        final_status_details["text_extraction_status"] = "failed"
                        final_status_details["text_extraction_detail"] = extracted_text_from_parser
                        # Modify the main message to reflect this issue
                        status_message = f'Crew processing finished for {filename}, but text extraction failed or yielded no content.'
                        update_task_status(
                            task_id=self.main_task_id, 
                            current_status='completed_with_issues', 
                            details=status_message, # API for update_task_status uses 'details' for main message here
                            result_data=final_status_details # Store the detailed breakdown in result_data
                        )
                        # The overall status is still "success" as the crew ran, but results indicate the issue.
                        return {"status": "success_with_issues", "task_id": self.main_task_id, "results": final_status_details}

                except json.JSONDecodeError:
                    print(f"CrewRunner: Could not parse JSON output from parsing_task: {parsing_task_output_str}")
                    # Store the raw output if JSON parsing fails
                    final_status_details["parsing_task_output_raw"] = parsing_task_output_str
                    final_status_details["text_extraction_status"] = "unknown_parser_output"
            else:
                print("CrewRunner: No output found for parsing_task.")
                final_status_details["text_extraction_status"] = "no_parser_output"

            # Default final status update if no specific extraction errors were caught above
            update_task_status(
                task_id=self.main_task_id, 
                current_status='completed', 
                details=f'Crew processing finished successfully for {filename}.', 
                result_data=final_status_details
            )
            return {"status": "success", "task_id": self.main_task_id, "results": final_status_details}

        except Exception as e:
            # Catch any exceptions during crew execution.
            error_message = f"Error during crew execution for Task ID {self.main_task_id}: {str(e)}"
            print(f"CrewRunner: {error_message}")
            import traceback # For detailed error logging.
            tb_str = traceback.format_exc()
            print(tb_str)

            # Handle cases where main_task_id might not have been set (e.g., error in initial status update).
            # This check should ideally not be needed if task_id_from_endpoint is always valid.
            if not self.main_task_id: # Simplified check
                print(f"CrewRunner: Critical error - main_task_id is not set: {str(e)}")
                # This scenario should be rare if task_id_from_endpoint is always provided.
                return {"status": "error", "task_id": None, "message": f"Critical error: {str(e)}"}
            
            # Update status to 'error' and include error details.
            update_task_status(
                task_id=self.main_task_id, 
                current_status='error', 
                details=f"An error occurred during AI processing: {str(e)}", # This becomes error_message in Supabase
                result_data={"error_details": str(e), "traceback": tb_str} # Store full traceback in result
            )
            return {"status": "error", "task_id": self.main_task_id, "message": str(e)}


    def run_document_drafting_crew(self, task_id_from_endpoint: str, case_id: str, client_data_json: dict, operator_instructions: str, template_id: str, user_id: str = None):
        """
        Runs the document drafting crew.
        This involves loading a template, preparing a prompt for the LLM to fill it,
        generating the document, saving it to storage, and recording it in the database.
        """
        self.main_task_id = task_id_from_endpoint
        print(f"CrewRunner: Document Drafting Crew started for Task ID: {self.main_task_id}, Case ID: {case_id}, Template: {template_id}")

        update_task_status(
            task_id=self.main_task_id,
            current_status='in_progress',
            details=f'Document drafting started for template: {template_id}, Case ID: {case_id}.',
            crew_type='document_drafter', # Make sure this is passed to status for filtering/identification
            user_id=user_id
        )

        if not self.llm:
            update_task_status(self.main_task_id, 'error', 'LLM not available for document drafting.', result_data={"error_details": "LLM client not initialized."})
            return {"status": "error", "task_id": self.main_task_id, "message": "LLM not available."}

        if not self.supabase_client:
            update_task_status(self.main_task_id, 'error', 'Supabase client not available for document drafting storage/DB operations.', result_data={"error_details": "Supabase client not initialized."})
            return {"status": "error", "task_id": self.main_task_id, "message": "Supabase client not available."}

        # 1. Load Template
        template_content = self._load_template(template_id)
        if not template_content:
            update_task_status(self.main_task_id, 'error', f"Failed to load template: {template_id}", result_data={"error_details": f"Template file '{template_id}' not found or could not be read."})
            return {"status": "error", "task_id": self.main_task_id, "message": f"Failed to load template: {template_id}"}

        # 2. Prepare LLM Prompt for Drafting Task
        generation_date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
        
        # We will use Jinja2 locally to pre-fill some metadata, then pass the mostly-filled template to LLM
        # for content fields. This is a hybrid approach.
        # Alternatively, the LLM could be given the raw template and all data, but this is more direct.
        try:
            jinja_env = jinja2.Environment(loader=jinja2.FileSystemLoader(os.path.dirname(self._load_template.__code__.co_filename) + '/../templates/')) # Path to templates dir
            template_obj = jinja_env.from_string(template_content) # Load from string after initial load
            
            # Pre-render with basic, non-sensitive data that LLM doesn't need to "decide" on
            # The LLM will be asked to fill in the substantive parts based on client_data and instructions
            # For this example, we'll let the LLM handle all {{ ... }} replacements based on the prompt.
            # The prompt will contain the raw template content.
        except Exception as e:
            print(f"CrewRunner: Jinja2 pre-rendering step failed (should not happen with from_string if template loaded): {e}")
            # Fallback: use raw template_content if pre-rendering concept causes issues.
            # For this subtask, the LLM is expected to handle the Jinja-like syntax based on the prompt.

        drafting_task_desc = dedent(f"""\
            You are tasked with generating a document by filling a Jinja2-like template.
            Your goal is to populate the template with the provided client data and adhere to operator instructions.
            The final output must ONLY be the populated template content. Do not add any extra commentary, preamble, or sign-off that isn't part of the template itself.

            Template Content:
            --- TEMPLATE START ---
            {template_content}
            --- TEMPLATE END ---

            Structured Client Data (JSON format):
            --- CLIENT DATA START ---
            {json.dumps(client_data_json, indent=2)}
            --- CLIENT DATA END ---

            Operator's Instructions:
            --- OPERATOR INSTRUCTIONS START ---
            {operator_instructions}
            --- OPERATOR INSTRUCTIONS END ---

            Instructions for Filling the Template:
            1.  Replace placeholders like `{{{{ client_data.some_field }}}}` with values from the "Structured Client Data".
            2.  If a field in "Structured Client Data" is missing or null, and the template specifies a default (e.g., `| default('N/A')`), imagine that default is applied or simply leave it as per template's default logic if not explicitly asked to fill. For fields like `{{{{ client_data.field | default("Text") }}}}`, if `client_data.field` is "Actual Value", use "Actual Value". If `client_data.field` is missing, use "Text".
            3.  Incorporate "Operator's Instructions" where the template has `{{{{ operator_instructions }}}}` or as general guidance for filling other fields if the instructions imply so.
            4.  The placeholder `{{{{ generation_date }}}}` should be filled with: "{generation_date_str}".
            5.  The placeholder `{{{{ case_id }}}}` should be filled with: "{case_id}".
            6.  Ensure the output is ONLY the fully populated document. Verify no extra text outside the document structure.
            """)

        drafting_task = Task(
            description=drafting_task_desc,
            expected_output="The fully populated document as a single string, with no additional surrounding text or explanations.",
            agent=self.document_drafter_agent,
            async_execution=False,
        )

        drafting_crew = Crew(
            agents=[self.document_drafter_agent],
            tasks=[drafting_task],
            process=Process.sequential,
            verbose=2
        )
        
        generated_document_str = None
        try:
            print(f"CrewRunner: Kicking off Document Drafting Crew for Task ID: {self.main_task_id}")
            # Inputs for kickoff can be minimal if all info is in the task description's prompt
            crew_result = drafting_crew.kickoff(inputs={}) 
            
            if isinstance(crew_result, str) and crew_result.strip(): # Crew AI might return raw string from single task
                generated_document_str = crew_result.strip()
            elif hasattr(crew_result, 'raw_output') and isinstance(crew_result.raw_output, str): # If it's a TaskOutput object
                 generated_document_str = crew_result.raw_output.strip()
            elif isinstance(crew_result, dict) and 'result' in crew_result and isinstance(crew_result['result'], str): # If crew returns a dict
                generated_document_str = crew_result['result'].strip()

            if not generated_document_str:
                # Check task output directly if crew_result is not the string
                task_output = drafting_task.output
                if task_output and isinstance(task_output.raw_output, str) and task_output.raw_output.strip():
                    generated_document_str = task_output.raw_output.strip()
                else:
                    print(f"CrewRunner: Document drafting crew result was empty or not a string. Result: {crew_result}, Task Output: {task_output}")
                    raise ValueError("LLM did not produce a document string.")
            
            print(f"CrewRunner: Document drafting crew finished for Task ID: {self.main_task_id}. (First 100 chars of doc): {generated_document_str[:100]}")

        except Exception as e:
            print(f"CrewRunner: Error during document drafting crew execution for Task ID {self.main_task_id}: {e}")
            import traceback
            tb_str = traceback.format_exc()
            update_task_status(self.main_task_id, 'error', f"LLM failed to generate document: {str(e)}", result_data={"error_details": str(e), "traceback": tb_str})
            return {"status": "error", "task_id": self.main_task_id, "message": f"LLM execution error: {str(e)}"}

        # 3. Save to Supabase Storage
        # Use .txt for simplicity; could be .docx if converting with another tool later.
        output_filename = f"{template_id.replace('.jinja2', '')}_{case_id.replace('-', '')}_{self.main_task_id.replace('-', '')}.txt"
        storage_bucket_name = os.getenv("SUPABASE_GENERATED_DOCUMENTS_BUCKET", "generated_documents")
        print(f"CrewRunner: Using target bucket for generated documents: {storage_bucket_name}")
        storage_file_path = f"{case_id}/{output_filename}" # Store under case_id folder

        try:
            # Convert string to bytes for upload
            file_bytes = generated_document_str.encode('utf-8')
            file_size = len(file_bytes)

            # Check if self.supabase_client is initialized (it should be from __init__)
            if not self.supabase_client:
                 raise ConnectionError("Supabase client not initialized in CrewRunner.")

            upload_response = self.supabase_client.storage.from_(storage_bucket_name).upload(
                path=storage_file_path,
                file=file_bytes, # Pass bytes directly
                file_options={"content-type": "text/plain;charset=utf-8", "upsert": "true"} # Upsert to overwrite if exists
            )
            print(f"CrewRunner: Upload response for {storage_file_path}: {upload_response.get('id') if hasattr(upload_response, 'get') else 'No ID in response'}") # Supabase py v2 returns dict not object with id
            # Supabase Python client v2 upload returns a dict like {'id': '...', 'path': '...', ...} on success
            # or throws an error which should be caught by the except block.
            # No specific error object in response dict for v2, it raises StorageException.

        except Exception as e: # Catch Supabase specific StorageException or general errors
            print(f"CrewRunner: Error uploading generated document to Supabase Storage for Task ID {self.main_task_id}: {e}")
            import traceback
            tb_str = traceback.format_exc()
            update_task_status(self.main_task_id, 'error', f"Failed to upload document to storage: {str(e)}", result_data={"error_details": str(e), "traceback": tb_str})
            return {"status": "error", "task_id": self.main_task_id, "message": f"Storage upload error: {str(e)}"}

        # 4. Add Record to `documents` Table
        document_record = {
            "case_id": case_id,
            "file_name": output_filename,
            "storage_path": storage_file_path, # Path used for upload is the storage_path
            "file_size": file_size,
            "file_type": "text/plain", # MIME type
            "bucket_name": storage_bucket_name,
            "status": "generated", # Or 'pending_review'
            "upload_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "uploaded_by_user_id": user_id, # Ensure this matches your DB column name
            "document_type": f"generated_{template_id.replace('.jinja2', '')}",
            "description": f"AI-generated document based on template '{template_id}'. Task ID: {self.main_task_id}.",
            "ai_processing_task_id": self.main_task_id # Link back to the AI task
        }

        try:
            db_response = self.supabase_client.table("documents").insert(document_record).execute()
            
            # supabase-py v2: response.data is a list of dicts
            if db_response.data and len(db_response.data) > 0:
                inserted_doc_id = db_response.data[0].get("id")
                print(f"CrewRunner: Document record inserted into 'documents' table with ID: {inserted_doc_id} for Task ID: {self.main_task_id}")
                # Update task status to completed
                update_task_status(
                    task_id=self.main_task_id,
                    current_status='completed',
                    details=f'Document "{output_filename}" generated and saved successfully.',
                    result_data={
                        "document_id": inserted_doc_id,
                        "storage_path": storage_file_path,
                        "filename": output_filename,
                        "bucket": storage_bucket_name
                    }
                )
                return {"status": "success", "task_id": self.main_task_id, "document_id": inserted_doc_id, "storage_path": storage_file_path}
            else:
                # Handle cases where insert might not return data as expected or error is in response
                error_msg = "Failed to insert document record into database or no ID returned."
                if hasattr(db_response, 'error') and db_response.error:
                    error_msg += f" DB Error: {db_response.error.message}"
                print(f"CrewRunner: {error_msg} for Task ID: {self.main_task_id}")
                # Attempt to delete the uploaded file from storage to prevent orphans
                try:
                    self.supabase_client.storage.from_(storage_bucket_name).remove([storage_file_path])
                    print(f"CrewRunner: Cleaned up orphaned file from storage: {storage_file_path}")
                except Exception as cleanup_e:
                    print(f"CrewRunner: Error during cleanup of orphaned file {storage_file_path}: {cleanup_e}")
                update_task_status(self.main_task_id, 'error', error_msg, result_data={"db_response": str(db_response)})
                return {"status": "error", "task_id": self.main_task_id, "message": error_msg}

        except Exception as e:
            print(f"CrewRunner: Error inserting document record into Supabase DB for Task ID {self.main_task_id}: {e}")
            import traceback
            tb_str = traceback.format_exc()
            # Attempt to delete the uploaded file from storage
            try:
                self.supabase_client.storage.from_(storage_bucket_name).remove([storage_file_path])
                print(f"CrewRunner: Cleaned up orphaned file from storage due to DB error: {storage_file_path}")
            except Exception as cleanup_e:
                print(f"CrewRunner: Error during cleanup of orphaned file {storage_file_path} after DB error: {cleanup_e}")
            update_task_status(self.main_task_id, 'error', f"Failed to save document record to database: {str(e)}", result_data={"error_details": str(e), "traceback": tb_str})
            return {"status": "error", "task_id": self.main_task_id, "message": f"Database insert error: {str(e)}"}


def get_crew_runner_instance():
    """
    Factory function to create and return an instance of LawFirmCrewRunner.
    This simplifies instance creation elsewhere in the application.
    """
    return LawFirmCrewRunner()

if __name__ == '__main__':
    print("--- Crew Runner Direct Test ---")
    
    # Ensure OPENAI_API_KEY is set in your environment for LLM-powered execution
    # Example: export OPENAI_API_KEY="your_key_here"
    
    runner = get_crew_runner_instance()
    
    sample_doc_info_with_text = {
        "filename": "sample_contract_with_text.pdf",
        "file_url": "file:///path/to/sample_contract_with_text.pdf", 
        "extracted_text": "This is the full text of a sample contract. Article 1: The parties agree to collaborate. Article 2: The term of this agreement is 12 months. Article 3: Termination can occur with 30 days notice by either party."
    }
    sample_user_query_contract = "Summarize the key terms and what are the termination conditions?"
    
    # Simulate a task ID being passed from an endpoint
    test_task_id_1 = str(uuid.uuid4())
    print(f"\nRunning crew with Document (with pre-extracted text): {sample_doc_info_with_text['filename']}, Query: '{sample_user_query_contract}', Task ID: {test_task_id_1}")
    # Mock initial status update that would happen in the endpoint
    update_task_status(task_id=test_task_id_1, current_status='queued', details=f"Test task queued for {sample_doc_info_with_text['filename']}", crew_type="test_parser")
    
    run_result_text = runner.run_crew(task_id_from_endpoint=test_task_id_1, document_info=sample_doc_info_with_text, user_query=sample_user_query_contract)
    print(f"\n--- Direct Result from run_crew (with text) ---")
    print(run_result_text)
    if run_result_text and run_result_text.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_text['task_id']}) ---")
        print(get_agent_status(run_result_text['task_id']))

    print("\n" + "="*50 + "\n")

    sample_doc_info_no_text = {
        "filename": "important_research_paper.docx",
        # "file_url" is not used by the tool, "file_path" and "bucket_name" are.
        # For local testing of the tool, you'd need a mock Supabase or a real one.
        # Here, we are testing the crew runner logic, so we assume the tool would be called.
        "file_path": "test_documents/important_research_paper.docx", # Example path
        "bucket_name": "test_bucket" # Example bucket
        # No 'extracted_text' field
    }
    sample_user_query_paper = "What are the main findings of this paper and suggest future research directions."
    
    test_task_id_2 = str(uuid.uuid4())
    print(f"\nRunning crew with Document (NO pre-extracted text): {sample_doc_info_no_text['filename']}, Query: '{sample_user_query_paper}', Task ID: {test_task_id_2}")
    update_task_status(task_id=test_task_id_2, current_status='queued', details=f"Test task queued for {sample_doc_info_no_text['filename']}", crew_type="test_parser")
        
    run_result_no_text = runner.run_crew(task_id_from_endpoint=test_task_id_2, document_info=sample_doc_info_no_text, user_query=sample_user_query_paper)
    print(f"\n--- Direct Result from run_crew (no text) ---")
    print(run_result_no_text)
    if run_result_no_text and run_result_no_text.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_no_text['task_id']}) ---")
        print(get_agent_status(run_result_no_text['task_id']))

    print("\n--- Testing with no user query (with pre-extracted text) ---")
    test_task_id_3 = str(uuid.uuid4())
    update_task_status(task_id=test_task_id_3, current_status='queued', details=f"Test task queued for {sample_doc_info_with_text['filename']} (no query)", crew_type="test_parser")
    
    run_result_no_query = runner.run_crew(task_id_from_endpoint=test_task_id_3, document_info=sample_doc_info_with_text, user_query="")
    print(f"\n--- Direct Result from run_crew (no query) ---")
    print(run_result_no_query)
    if run_result_no_query and run_result_no_query.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_no_query['task_id']}) (no query) ---")
        print(get_agent_status(run_result_no_query['task_id']))

    print("\n" + "="*50 + "\n")
    print("--- Crew Runner Document Drafting Test ---")

    # Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set for storage/DB operations.
    # Also OPENAI_API_KEY for the LLM.
    if runner.llm and runner.supabase_client:
        draft_task_id = str(uuid.uuid4())
        sample_case_id = "CASE-001"
        sample_client_data = {
            "disclosing_party_name": "Innovate Corp",
            "disclosing_party_address": "123 Tech Park, Silicon Valley, CA",
            "receiving_party_name": "Beta Solutions Ltd.",
            "receiving_party_address": "456 Business Bay, Bangalore, India",
            "effective_date": "2024-04-01",
            "purpose_of_nda": "Evaluation of potential business collaboration.",
            "definition_of_confidential_information": "All technical, business, and financial information exchanged.",
            "additional_clauses": "Any software provided under this NDA remains the property of Innovate Corp."
        }
        sample_operator_instructions = "Ensure the purpose is clearly stated. The jurisdiction for any disputes should be California."
        sample_template_id = "nda_template.jinja2" # Ensure this template exists in backend/templates/
        
        # Mock initial 'queued' status for the drafting task
        update_task_status(
            task_id=draft_task_id,
            current_status='queued',
            details=f"Document drafting task queued for template {sample_template_id}, Case ID {sample_case_id}",
            crew_type='document_drafter',
            # user_id="test_user_drafting" # Example user ID
        )

        print(f"\nRunning document drafting crew for Task ID: {draft_task_id}, Template: {sample_template_id}")
        drafting_result = runner.run_document_drafting_crew(
            task_id_from_endpoint=draft_task_id,
            case_id=sample_case_id,
            client_data_json=sample_client_data,
            operator_instructions=sample_operator_instructions,
            template_id=sample_template_id,
            # user_id="test_user_drafting"
        )
        print(f"\n--- Direct Result from run_document_drafting_crew ---")
        print(drafting_result)
        if drafting_result and drafting_result.get("task_id"):
            print(f"\n--- Final Status from get_agent_status (Drafting Task ID: {drafting_result['task_id']}) ---")
            final_status_draft = get_agent_status(drafting_result['task_id'])
            print(final_status_draft)
            if final_status_draft.get("status") == "completed":
                print(f"Drafted document details: {final_status_draft.get('result')}")
    else:
        print("\nSkipping Document Drafting Test: LLM or Supabase client not initialized (check API keys and .env).")

    print("\n--- All Tests Concluded ---")
