# backend/agents/task_generator.py
# Generates tasks for AI agents based on input or predefined logic.

def generate_legal_tasks(document_info, user_query):
    """
    Placeholder for generating a list of tasks for the Crew AI agents.
    This could involve analyzing the document_info and user_query
    to create specific, actionable tasks.
    """
    print(f"TaskGenerator: Received document_info - {document_info}, user_query - {user_query}")
    
    tasks = []
    # Example task generation logic:
    if "contract" in document_info.get("type", "").lower():
        tasks.append({
            "name": "Review Contract Terms",
            "description": f"Thoroughly review the terms in the provided contract: {document_info.get('filename', 'N/A')}.",
            "assignee_role_suggestion": "Legal Analyst Agent" 
        })
    
    if user_query:
        tasks.append({
            "name": "Address User Query",
            "description": f"Address the specific user query: '{user_query}' based on the document.",
            "assignee_role_suggestion": "Client Communication Agent"
        })

    if not tasks:
        tasks.append({
            "name": "General Document Review",
            "description": f"Perform a general review of the document: {document_info.get('filename', 'N/A')}.",
            "assignee_role_suggestion": "Junior Associate Agent"
        })
        
    return {"status": "success", "generated_tasks": tasks}

if __name__ == '__main__':
    # Example usage
    doc_info = {"type": "contract", "filename": "agreement.pdf"}
    query = "What are the termination clauses?"
    generated = generate_legal_tasks(doc_info, query)
    print("Task Generator Test Result:", generated)
