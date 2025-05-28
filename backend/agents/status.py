# backend/agents/status.py
# Handles agent status tracking and reporting.
import datetime
import uuid

_agent_tasks_status = {} # Placeholder for in-memory status storage

def get_agent_status(task_id: str):
    """
    Placeholder for retrieving the status of a specific agent task.
    """
    print(f"Status: Checking status for task_id - {task_id}")
    
    status = _agent_tasks_status.get(task_id, {
        "status": "not_found",
        "message": f"No status information found for task_id: {task_id}. (Placeholder response)"
    })
    return status

def update_task_status(task_id: str = None, current_status: str = "pending", details: str = ""):
    """
    Updates the status of a task. If task_id is not provided or is empty,
    a new UUID is generated.
    Always returns the task_id.
    """
    if not task_id:
        task_id = str(uuid.uuid4())
        print(f"Status: New task_id generated - {task_id}")

    print(f"Status: Updating status for task_id - {task_id} to {current_status}")
    _agent_tasks_status[task_id] = {
        "status": current_status,
        "message": details if details else f"Task is currently {current_status}.",
        "last_updated": datetime.datetime.now().isoformat()
    }
    return task_id

if __name__ == '__main__':
    # Example usage
    # Scenario 1: No task_id provided, should generate one
    print("\n--- Scenario 1: No task_id provided ---")
    generated_task_id = update_task_status(current_status="pending", details="Task initiated, awaiting processing.")
    print(f"Generated Task ID: {generated_task_id}")
    status_report_generated = get_agent_status(generated_task_id)
    print(f"Status Report (Generated ID - {generated_task_id}): {status_report_generated}")

    # Scenario 2: task_id provided
    print("\n--- Scenario 2: task_id provided ---")
    provided_task_id = "task_123"
    returned_task_id_provided = update_task_status(provided_task_id, "in_progress", "Agent is currently processing the document.")
    print(f"Returned Task ID (Provided ID - {provided_task_id}): {returned_task_id_provided}")
    status_report_provided = get_agent_status(provided_task_id)
    print(f"Status Report (Provided ID - {provided_task_id}): {status_report_provided}")

    # Scenario 3: Update status of an existing task (using generated_task_id from Scenario 1)
    print("\n--- Scenario 3: Update status of an existing task ---")
    update_task_status(generated_task_id, "completed", "Processing finished successfully.")
    status_report_updated = get_agent_status(generated_task_id)
    print(f"Status Report (Updated - {generated_task_id}): {status_report_updated}")

    # Scenario 4: Check status of an unknown task
    print("\n--- Scenario 4: Check status of an unknown task ---")
    status_report_unknown = get_agent_status("task_456")
    print(f"Status Report (Unknown ID - task_456): {status_report_unknown}")

    # Scenario 5: Task with error status
    print("\n--- Scenario 5: Task with error status ---")
    error_task_id = update_task_status(current_status="error", details="An error occurred during processing.")
    print(f"Error Task ID: {error_task_id}")
    status_report_error = get_agent_status(error_task_id)
    print(f"Status Report (Error ID - {error_task_id}): {status_report_error}")
    
    # Verify all tasks in storage
    print("\n--- All stored tasks ---")
    for tid, tstatus in _agent_tasks_status.items():
        print(f"Task: {tid}, Status: {tstatus}")
