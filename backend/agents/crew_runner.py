# backend/agents/crew_runner.py
# This module is responsible for managing the execution of Crew AI agents.
# It defines the agents, tasks, and the overall crew that processes documents.
import os
import uuid # Standard library for generating unique IDs
import json # For handling JSON strings, especially from LLM outputs
from textwrap import dedent # For cleaner multi-line string definitions (e.g., backstories)

from crewai import Agent, Task, Crew, Process # Core Crew AI components
from langchain_openai import ChatOpenAI # Specific LLM implementation from Langchain

# Local imports for status tracking and (previously) task generation
from backend.agents.status import update_task_status, get_agent_status
# Note: generate_legal_tasks from task_generator.py is no longer directly used here.


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
                # gpt-4o is chosen for its capabilities, including potentially better JSON output handling.
                # Temperature is set to 0.2 for more deterministic and less "creative" outputs.
                self.llm = ChatOpenAI(api_key=openai_api_key, temperature=0.2, model_name="gpt-4o")
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
        self.document_parser_agent = Agent(
            role='DocumentParserAgent',
            goal='Parse and extract key information and a summary from documents. If document text is provided, use it. Otherwise, state that text extraction from URL is not yet implemented but provide a mock text for summarization.',
            backstory=dedent("""A specialized agent for dissecting document content. 
            It focuses on extracting the full text and then creating a concise summary."""),
            # TODO: Implement a real document fetching tool for URLs when doc_text_content is not provided.
            # This agent would then need a tool like a web scraper or PDF text extractor.
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

    def run_crew(self, document_info: dict, user_query: str = None):
        """
        Runs the legal analysis crew. This involves:
        1. Initializing a main task ID for status tracking.
        2. Defining tasks for document parsing and subsequent task definition.
        3. Executing these tasks using the configured Crew (either with a real LLM or mock fallbacks).
        4. Updating the status of the main task ID throughout the process.

        Args:
            document_info (dict): Information about the document, potentially including
                                  'file_url', 'filename', and 'extracted_text'.
            user_query (str, optional): A specific query from the user regarding the document.

        Returns:
            dict: A dictionary containing the status of the crew run ('success' or 'error'),
                  the main_task_id, and the results (either from LLM or mock).
        """
        # Generate a new main_task_id for this specific crew run.
        # This allows tracking the overall progress of the document processing.
        self.main_task_id = update_task_status(
            task_id=None, # Ensures a new ID is generated by status.py
            current_status='pending',
            details='Crew run initiated.'
        )
        print(f"CrewRunner: Main Task ID for this run: {self.main_task_id}")
        
        filename = document_info.get("filename", "N/A")
        file_url = document_info.get("file_url", "N/A")
        # Prioritize pre-extracted text if available, as it avoids needing a web scraping tool.
        doc_text_content = document_info.get("extracted_text") 
        
        # Log if pre-extracted text is missing, as it affects the DocumentParserAgent's behavior.
        if not doc_text_content and self.llm: 
             print(f"CrewRunner: No pre-extracted text for {filename}. DocumentParserAgent will use mock text for summarization if URL processing isn't available (as no web tool is integrated yet).")
        
        actual_crew_result = None # To store the final output from the crew.

        try:
            # Update status: Document parsing and summarization step begins.
            update_task_status(self.main_task_id, 'in_progress', f'Document parsing and summarization in progress for: {filename}')

            # --- Define Parsing Task ---
            # This task is handled by the DocumentParserAgent.
            # Its goal is to extract text (if not provided) and summarize it.
            parsing_task_desc = (
                f'Analyze the document: {filename}. '
                f'Input document URL (for context, if available): {file_url}. '
            )
            if doc_text_content:
                # If text is already extracted, the agent should use it.
                parsing_task_desc += "Use the provided document_text_content as the primary source for extraction and summarization. "
            else:
                # If no text, and LLM is active, agent should acknowledge lack of web tool and use mock.
                # TODO: Integrate a web scraping or document fetching tool here.
                parsing_task_desc += "No direct text content provided. If you had a web scraping tool, you would use it on the document_url. For now, acknowledge this and create a mock document text. "
            
            parsing_task_desc += 'Then, provide a concise summary of the text (approx. 150-200 words).'
            
            parsing_task = Task(
                description=parsing_task_desc,
                expected_output='A JSON object containing two keys: "extracted_text" (string) and "summary" (string). If using mock text, clearly state it in the "extracted_text" field.',
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
                    'document_url': file_url,
                    'user_query': user_query or "", 
                    'document_text_content': doc_text_content or "" 
                }
                actual_crew_result = crew.kickoff(inputs=kickoff_inputs)
                
                # Update status: Follow-up task generation (second step of the crew) is in progress.
                update_task_status(self.main_task_id, 'in_progress', 'Generating follow-up tasks using LLM...')
                print(f"CrewRunner: LLM-powered crew finished for Task ID: {self.main_task_id}. Result: {actual_crew_result}")

            else: 
                # LLM is NOT available: Fallback to mock execution.
                # This ensures the system can run end-to-end for testing or when API keys are missing.
                print(f"CrewRunner: LLM not available. Running mock crew for Task ID: {self.main_task_id}")
                
                # Simulate output for parsing_task.
                mock_extracted_text = f"This is MOCK extracted text from '{filename}'. Actual text extraction from URL ({file_url}) is not implemented without tools/LLM." if not doc_text_content else doc_text_content
                mock_summary = f"This is a MOCK summary for '{filename}'. It highlights key MOCK points of the document."
                # Agents are expected to return strings, so mock outputs are JSON strings.
                mock_parsing_output_str = json.dumps({ 
                    "extracted_text": mock_extracted_text,
                    "summary": mock_summary
                })
                print(f"CrewRunner: Mock parsing_task output: {mock_parsing_output_str}")
                # In a real sequential execution, this output would be passed to the next task.
                # The Crew AI framework handles this. For mock, we just log it.
                
                update_task_status(self.main_task_id, 'in_progress', 'Generating mock follow-up tasks...')
                
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

            # Final status update: Crew processing is complete.
            update_task_status(self.main_task_id, 'completed', 'Crew processing finished.', details=actual_crew_result)
            return {"status": "success", "task_id": self.main_task_id, "results": actual_crew_result}

        except Exception as e:
            # Catch any exceptions during crew execution.
            error_message = f"Error during crew execution for Task ID {self.main_task_id}: {str(e)}"
            print(f"CrewRunner: {error_message}")
            import traceback # For detailed error logging.
            traceback.print_exc() 

            # Handle cases where main_task_id might not have been set (e.g., error in initial status update).
            if not hasattr(self, 'main_task_id') or not self.main_task_id:
                print(f"CrewRunner: Critical error before main_task_id assignment or in early stages: {str(e)}")
                # TODO: Consider a more robust way to handle/log critical early failures.
                return {"status": "error", "task_id": None, "message": f"Critical error: {str(e)}"}
            
            # Update status to 'error' and include error details.
            update_task_status(self.main_task_id, 'error', f"An error occurred: {str(e)}", details={"error_details": str(e), "traceback": traceback.format_exc()})
            return {"status": "error", "task_id": self.main_task_id, "message": str(e)}


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
    
    print(f"\nRunning crew with Document (with pre-extracted text): {sample_doc_info_with_text['filename']}, Query: '{sample_user_query_contract}'")
    run_result_text = runner.run_crew(document_info=sample_doc_info_with_text, user_query=sample_user_query_contract)
    print(f"\n--- Direct Result from run_crew (with text) ---")
    print(run_result_text)
    if run_result_text and run_result_text.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_text['task_id']}) ---")
        print(get_agent_status(run_result_text['task_id']))

    print("\n" + "="*50 + "\n")

    sample_doc_info_no_text = {
        "filename": "important_research_paper.docx",
        "file_url": "file:///path/to/important_research_paper.docx",
        # No 'extracted_text' field, will trigger mock text generation if LLM is on, or full mock if LLM off
    }
    sample_user_query_paper = "What are the main findings of this paper and suggest future research directions."
    
    print(f"\nRunning crew with Document (NO pre-extracted text): {sample_doc_info_no_text['filename']}, Query: '{sample_user_query_paper}'")
    run_result_no_text = runner.run_crew(document_info=sample_doc_info_no_text, user_query=sample_user_query_paper)
    print(f"\n--- Direct Result from run_crew (no text) ---")
    print(run_result_no_text)
    if run_result_no_text and run_result_no_text.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_no_text['task_id']}) ---")
        print(get_agent_status(run_result_no_text['task_id']))

    print("\n--- Testing with no user query (with pre-extracted text) ---")
    run_result_no_query = runner.run_crew(document_info=sample_doc_info_with_text, user_query="")
    print(f"\n--- Direct Result from run_crew (no query) ---")
    print(run_result_no_query)
    if run_result_no_query and run_result_no_query.get("task_id"):
        print(f"\n--- Final Status from get_agent_status (Task ID: {run_result_no_query['task_id']}) (no query) ---")
        print(get_agent_status(run_result_no_query['task_id']))
