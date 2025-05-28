# backend/agents/task_generator.py
# Generates tasks for AI agents based on input or predefined logic.
# NOTE: The core task generation logic for the main document processing workflow
# has been integrated into the TaskDefinitionAgent within crew_runner.py.
# This module is currently only used by the potentially deprecated /generate-task/ 
# endpoint in main.py. Consider removing this module if that endpoint is removed.

import uuid

def generate_legal_tasks(document_info, user_query):
    """
    Generates a list of structured tasks for AI agents based on document_info
    and user_query.
    """
    print(f"TaskGenerator: Received document_info - {document_info}, user_query - '{user_query}'")
    
    tasks = []
    doc_filename = document_info.get("filename", "")
    doc_content_type = document_info.get("content_type", "")
    # Use extracted_text if available, otherwise indicate it's not for tasks needing it.
    doc_text = document_info.get("extracted_text", "Document text not available or not extracted.")

    # Heuristic for identifying contracts (can be improved)
    is_contract = "contract" in doc_filename.lower() or \
                  doc_filename.lower().endswith((".pdf", ".docx")) or \
                  "application/pdf" in doc_content_type or \
                  "contract" in doc_text.lower() # Basic text check

    if is_contract:
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": "Identify Key Contractual Clauses",
            "description": f"Identify and list key contractual clauses from the document '{doc_filename}'. This includes, but is not limited to, parties involved, term, payment obligations, termination clauses, and governing law.",
            "agent_role_suggestion": "LegalAnalysisAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename},
            "expected_output_format": "A list of identified clauses with brief descriptions of each."
        })
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": "Assess Contractual Risks",
            "description": f"Analyze the document '{doc_filename}' for potential contractual risks, such as ambiguous terms, unfavorable clauses, or missing essential provisions.",
            "agent_role_suggestion": "RiskAssessmentAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename},
            "expected_output_format": "A report detailing potential risks, categorized by severity."
        })

    if user_query:
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": f"Address User Query: {user_query[:30]}...", # Truncate long queries for name
            "description": f"Address the specific user query: '{user_query}' based on the document '{doc_filename}'.",
            "agent_role_suggestion": "QueryResolutionAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename, "user_query": user_query},
            "expected_output_format": "A clear and concise answer to the user's query, supported by evidence from the document where possible."
        })

    if not tasks: # If no specific tasks were generated (e.g., not a contract and no query)
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": "General Document Review",
            "description": f"Perform a general review of the document '{doc_filename}'. This should include a summary and extraction of key information.",
            "agent_role_suggestion": "GeneralReviewAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename},
            "expected_output_format": "A document summary (approx. 150-200 words) and a list of key pieces of information extracted."
        })
        # Example of breaking down a general task implicitly
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": "Summarize Document",
            "description": f"Create a concise summary of the document '{doc_filename}'.",
            "agent_role_suggestion": "SummarizationAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename},
            "expected_output_format": "A concise summary of the document, approximately 200 words."
        })
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "name": "Extract Key Information",
            "description": f"Extract key pieces of information (e.g., names, dates, locations, main topics) from '{doc_filename}'.",
            "agent_role_suggestion": "InformationExtractionAgent",
            "inputs": {"document_text": doc_text, "filename": doc_filename},
            "expected_output_format": "A list of key information points or a structured data format (e.g., JSON)."
        })
        
    return {"status": "success", "generated_tasks": tasks}

if __name__ == '__main__':
    # Example Usage

    sample_contract_text = """
    AGREEMENT FOR SERVICES
    This Agreement for Services ("Agreement") is made and entered into as of this 1st day of January, 2024 ("Effective Date"), 
    by and between ACME Corp ("Client"), and ZETA Solutions ("Provider").
    WHEREAS, Client requires services for software development; and
    WHEREAS, Provider is engaged in the business of providing such services;
    NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:
    1. Services. Provider shall perform software development services as described in Exhibit A.
    2. Term. This Agreement shall commence on the Effective Date and shall continue for a period of twelve (12) months, unless earlier terminated.
    3. Payment. Client shall pay Provider the sum of $10,000 USD per month.
    4. Termination. Either party may terminate this Agreement with 30 days written notice.
    """

    print("\n--- Scenario 1: Contract Document (PDF) with User Query ---")
    doc_info_contract = {
        "filename": "SuperImportantContract.pdf", 
        "content_type": "application/pdf",
        "extracted_text": sample_contract_text
    }
    query_contract = "What are the payment terms and how can this contract be terminated?"
    generated_contract_tasks = generate_legal_tasks(doc_info_contract, query_contract)
    print(f"Status: {generated_contract_tasks['status']}")
    for task in generated_contract_tasks['generated_tasks']:
        print(f"  Task ID: {task['task_id']}")
        print(f"    Name: {task['name']}")
        print(f"    Description: {task['description']}")
        print(f"    Agent Role: {task['agent_role_suggestion']}")
        print(f"    Inputs: {task['inputs']}")
        print(f"    Expected Output: {task['expected_output_format']}\n")

    print("\n--- Scenario 2: Generic Document (TXT) without User Query ---")
    doc_info_generic = {
        "filename": "meeting_notes.txt", 
        "content_type": "text/plain",
        "extracted_text": "Meeting Notes - Project Phoenix\nAttendees: Alice, Bob, Charlie\nDate: 2024-07-30\nKey points: Discussed milestone 1, budget constraints, and resource allocation. Next meeting scheduled for next week."
    }
    query_generic = "" # No specific query
    generated_generic_tasks = generate_legal_tasks(doc_info_generic, query_generic)
    print(f"Status: {generated_generic_tasks['status']}")
    for task in generated_generic_tasks['generated_tasks']:
        print(f"  Task ID: {task['task_id']}")
        print(f"    Name: {task['name']}")
        print(f"    Description: {task['description']}")
        print(f"    Agent Role: {task['agent_role_suggestion']}")
        print(f"    Inputs: {task['inputs']}")
        print(f"    Expected Output: {task['expected_output_format']}\n")

    print("\n--- Scenario 3: Non-Contract Document (Word) with a specific query ---")
    doc_info_word = {
        "filename": "research_paper_summary.docx",
        "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "extracted_text": "This paper discusses the impact of AI on climate change. The findings suggest a positive correlation if AI is used for energy optimization."
    }
    query_word = "What is the main finding of this paper regarding AI and climate change?"
    generated_word_tasks = generate_legal_tasks(doc_info_word, query_word)
    print(f"Status: {generated_word_tasks['status']}")
    for task in generated_word_tasks['generated_tasks']:
        print(f"  Task ID: {task['task_id']}")
        print(f"    Name: {task['name']}")
        print(f"    Description: {task['description']}")
        print(f"    Agent Role: {task['agent_role_suggestion']}")
        print(f"    Inputs: {task['inputs']}")
        print(f"    Expected Output: {task['expected_output_format']}\n")
