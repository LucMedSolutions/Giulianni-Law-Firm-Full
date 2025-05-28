# backend/agents/status.py
# Handles agent status tracking and reporting.
import datetime

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

def update_task_status(task_id: str, current_status: str, details: str = ""):
    """
    Placeholder for updating the status of a task.
    """
    print(f"Status: Updating status for task_id - {task_id} to {current_status}")
    _agent_tasks_status[task_id] = {
        "status": current_status,
        "message": details if details else f"Task is currently {current_status}.",
        "last_updated": datetime.datetime.now().isoformat()
    }
    return {"status": "updated", "task_id": task_id}

if __name__ == '__main__':
    # Example usage
    update_task_status("task_123", "in_progress", "Agent is currently processing the document.")
    status_report = get_agent_status("task_123")
    print("Agent Status Test (task_123):", status_report)
    
    status_report_unknown = get_agent_status("task_456")
    print("Agent Status Test (task_456):", status_report_unknown)
