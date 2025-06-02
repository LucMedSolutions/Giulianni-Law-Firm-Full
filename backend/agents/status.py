# backend/agents/status.py
# Handles agent status tracking and reporting using Supabase.

# SQL schema for ai_processing_tasks table
# This should be created in your Supabase project.

# -- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Ensure UUID functions are available

# -- CREATE TABLE IF NOT EXISTS ai_processing_tasks (
# --     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
# --     status TEXT NOT NULL,
# --     details TEXT,
# --     error_message TEXT,
# --     result JSONB,
# --     created_at TIMESTAMPTZ DEFAULT now(),
# --     last_updated TIMESTAMPTZ DEFAULT now(),
# --     crew_type TEXT,
# --     user_id UUID, -- Assuming it links to auth.users table
# --     CONSTRAINT fk_user
# --         FOREIGN KEY(user_id) 
# --         REFERENCES auth.users(id)
# --         ON DELETE SET NULL -- Or ON DELETE CASCADE, depending on requirements
# -- );

# -- COMMENT ON COLUMN ai_processing_tasks.details IS 'General descriptive text about the task status.';
# -- COMMENT ON COLUMN ai_processing_tasks.error_message IS 'Specific error message if the status is ''error''.';
# -- COMMENT ON COLUMN ai_processing_tasks.result IS 'JSONB field to store the final output or result of the task.';
# -- COMMENT ON COLUMN ai_processing_tasks.crew_type IS 'Identifier for the type of crew processing the task, e.g., ''document_parser'', ''document_drafter''.';
# -- COMMENT ON COLUMN ai_processing_tasks.user_id IS 'Optional foreign key linking to the user who initiated the task.';

# -- Function to update last_updated timestamp
# -- CREATE OR REPLACE FUNCTION trigger_set_timestamp()
# -- RETURNS TRIGGER AS $$
# -- BEGIN
# --   NEW.last_updated = NOW();
# --   RETURN NEW;
# -- END;
# -- $$ LANGUAGE plpgsql;

# -- Trigger to update last_updated on row update
# -- CREATE TRIGGER set_timestamp
# -- BEFORE UPDATE ON ai_processing_tasks
# -- FOR EACH ROW
# -- EXECUTE FUNCTION trigger_set_timestamp();

# -- To enable RLS (Row Level Security) on the table (recommended for multi-user scenarios):
# -- ALTER TABLE ai_processing_tasks ENABLE ROW LEVEL SECURITY;

# -- Example policies (adjust based on your application's needs):
# -- Allow users to see their own tasks
# -- CREATE POLICY "Allow individual user read access"
# -- ON ai_processing_tasks
# -- FOR SELECT
# -- USING (auth.uid() = user_id);

# -- Allow users to create tasks for themselves
# -- CREATE POLICY "Allow individual user insert access"
# -- ON ai_processing_tasks
# -- FOR INSERT
# -- WITH CHECK (auth.uid() = user_id);

# -- Allow users to update their own tasks
# -- CREATE POLICY "Allow individual user update access"
# -- ON ai_processing_tasks
# -- FOR UPDATE
# -- USING (auth.uid() = user_id)
# -- WITH CHECK (auth.uid() = user_id);

# -- Allow service role to bypass RLS (e.g., for backend services)
# -- This is usually default, but good to be aware of.
# -- Note: Be cautious with policies and ensure they match your security requirements.

import os
import uuid
import datetime
from supabase import create_client, Client as SupabaseClient # Use Client alias for clarity

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_service_key:
    # Allow functions to be imported without erroring if env vars are not set,
    # but they will fail if used. This is useful for documentation generation or static analysis.
    print("Warning: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are not set. "
          "Supabase functionality will be disabled.")
    supabase: SupabaseClient = None 
else:
    try:
        supabase: SupabaseClient = create_client(supabase_url, supabase_service_key)
        print("Supabase client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        supabase: SupabaseClient = None


def get_agent_status(task_id: str):
    """
    Retrieves the status of a specific agent task from Supabase.
    """
    if not supabase:
        print("Error: Supabase client not initialized. Cannot get task status.")
        return {
            "status": "error_fetching",
            "message": "Supabase client not initialized."
        }

    print(f"Status: Checking status for task_id - {task_id} from Supabase")
    try:
        response = supabase.table("ai_processing_tasks").select("*").eq("id", task_id).maybe_single().execute()
        
        if response.data:
            return response.data
        else:
            # Check for actual error in response if using supabase-py v1.x style
            if hasattr(response, 'error') and response.error:
                print(f"Supabase error fetching task {task_id}: {response.error.message}")
                return {
                    "status": "error_fetching",
                    "message": f"Error fetching status from Supabase: {response.error.message}"
                }
            return {
                "id": task_id, # Keep task_id in the response for consistency
                "status": "not_found",
                "message": f"No status information found for task_id: {task_id} in Supabase."
            }
    except Exception as e:
        print(f"Error fetching task status from Supabase for {task_id}: {e}")
        return {
            "id": task_id,
            "status": "error_fetching",
            "message": f"Error fetching status for task_id {task_id}: {str(e)}"
        }

def update_task_status(
    task_id: str = None,
    current_status: str = "pending",
    details: str = None,
    result_data: dict = None,
    crew_type: str = None,
    user_id: str = None  # Assuming user_id is a string UUID from the client
):
    """
    Updates the status of a task in Supabase. If task_id is not provided, a new UUID is generated.
    Always returns the task_id.
    """
    if not supabase:
        print("Error: Supabase client not initialized. Cannot update task status.")
        # Potentially raise an error or return a specific indicator if critical
        if not task_id: # Still generate a task_id if one wasn't provided for local context
            task_id = str(uuid.uuid4())
        return task_id # Or None, or raise error

    if not task_id:
        task_id = str(uuid.uuid4())
        print(f"Status: New task_id generated - {task_id}")

    print(f"Status: Updating status for task_id - {task_id} to {current_status} in Supabase")

    record = {
        "id": task_id,
        "status": current_status,
        # last_updated will be handled by the database trigger ideally
        # "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "result": result_data if result_data else None,
        "crew_type": crew_type,
    }
    
    # Only include user_id if it's provided and valid, otherwise Supabase might error on invalid UUID
    if user_id:
        try:
            uuid.UUID(user_id) # Validate if it's a UUID
            record["user_id"] = user_id
        except ValueError:
            print(f"Warning: Provided user_id '{user_id}' is not a valid UUID. Skipping.")


    if current_status == 'error':
        record["error_message"] = details
        record["details"] = None 
    else:
        record["details"] = details
        record["error_message"] = None

    try:
        # Upsert operation: inserts if id doesn't exist, updates if it does.
        # Supabase-py v2+ returns a list of dictionaries (records) in response.data
        # Supabase-py v1.x might return an APIResponse object
        response = supabase.table("ai_processing_tasks").upsert(record).execute()

        # Check response structure for supabase-py v1 vs v2
        # For v2, response.data is a list of dicts. For v1, it might be an APIResponse object.
        # The execute() method in v2 should raise an exception on error.
        # If using PostgrestAPIResponse (v1 style):
        if hasattr(response, 'error') and response.error:
            raise Exception(f"Supabase error updating task: {response.error.message} (Details: {response.error.details})")
        elif response.data:
             print(f"Status update for {task_id} successful. Data: {response.data[0]['id']}")
        else:
            # This case might indicate an issue if no data and no error (should not happen with upsert normally)
            print(f"Status update for {task_id} potentially successful, but no data returned in response.")

    except Exception as e:
        print(f"Error updating task status in Supabase for {task_id}: {e}")
        # Optionally, re-raise or handle if critical, e.g., if the task must be tracked
    return task_id


if __name__ == '__main__':
    # Example usage for Supabase-backed status
    # Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your environment,
    # or in a .env file if you are using python-dotenv.
    # from dotenv import load_dotenv
    # load_dotenv() # Load .env file for local testing

    if not supabase:
        print("Supabase client not available. Skipping live tests.")
        exit()

    print("Running Supabase status tests...")

    # Scenario 1: Create a new task
    print("\n--- Scenario 1: Create a new task ---")
    task1_id = update_task_status(
        current_status="pending",
        details="Task initiated for Supabase.",
        crew_type="test_crew",
        # user_id="a_valid_auth_user_id_if_testing_rls" # Replace with a real user UUID if needed
    )
    print(f"Generated Task ID: {task1_id}")
    status_report_task1 = get_agent_status(task1_id)
    print(f"Status Report (Task 1 - {task1_id}): {status_report_task1}")
    assert status_report_task1.get("status") == "pending"

    # Scenario 2: Update the task to in_progress
    print("\n--- Scenario 2: Update task to in_progress ---")
    update_task_status(
        task_id=task1_id,
        current_status="in_progress",
        details="Task is now being processed by the test_crew."
    )
    status_report_task1_inprogress = get_agent_status(task1_id)
    print(f"Status Report (Task 1 In Progress - {task1_id}): {status_report_task1_inprogress}")
    assert status_report_task1_inprogress.get("status") == "in_progress"
    assert status_report_task1_inprogress.get("details") == "Task is now being processed by the test_crew."

    # Scenario 3: Update the task to completed with a result
    print("\n--- Scenario 3: Update task to completed with result ---")
    result_example = {"output": "This is the final result of the task.", "items_processed": 10}
    update_task_status(
        task_id=task1_id,
        current_status="completed",
        details="Task completed successfully.",
        result_data=result_example
    )
    status_report_task1_completed = get_agent_status(task1_id)
    print(f"Status Report (Task 1 Completed - {task1_id}): {status_report_task1_completed}")
    assert status_report_task1_completed.get("status") == "completed"
    assert status_report_task1_completed.get("result") == result_example

    # Scenario 4: Create a task that will result in an error
    print("\n--- Scenario 4: Create a task that results in an error ---")
    task2_id = update_task_status(
        current_status="processing", # Initial status before error
        details="About to simulate an error.",
        crew_type="error_crew"
    )
    update_task_status(
        task_id=task2_id,
        current_status="error",
        details="A simulated error occurred during processing."
    )
    status_report_task2_error = get_agent_status(task2_id)
    print(f"Status Report (Task 2 Error - {task2_id}): {status_report_task2_error}")
    assert status_report_task2_error.get("status") == "error"
    assert status_report_task2_error.get("error_message") == "A simulated error occurred during processing."
    assert status_report_task2_error.get("details") is None

    # Scenario 5: Check status of an unknown task
    print("\n--- Scenario 5: Check status of an unknown task ---")
    unknown_task_id = str(uuid.uuid4())
    status_report_unknown = get_agent_status(unknown_task_id)
    print(f"Status Report (Unknown ID - {unknown_task_id}): {status_report_unknown}")
    assert status_report_unknown.get("status") == "not_found"

    # Scenario 6: Task with a user_id
    print("\n--- Scenario 6: Task with user_id ---")
    # IMPORTANT: For this to work, 'your_user_uuid' should be a valid UUID 
    # that exists in your 'auth.users' table if FK constraint is active.
    # If not, Supabase might reject the insert/upsert or it might store null
    # depending on your table policies and constraints.
    # For testing without a live user, you might comment out the user_id or use a placeholder
    # if your RLS/policies allow it.
    test_user_id = str(uuid.uuid4()) # Using a random UUID for example; may not exist in auth.users
    task3_id = update_task_status(
        current_status="pending_user",
        details="Task associated with a user.",
        crew_type="user_specific_crew",
        user_id=test_user_id 
    )
    status_report_task3_user = get_agent_status(task3_id)
    print(f"Status Report (Task 3 User - {task3_id}): {status_report_task3_user}")
    if status_report_task3_user.get("status") != "error_fetching": # if insert was allowed
      # user_id might be null if the FK prevented it and set to null, or it might be the test_user_id
      # This depends on DB schema (ON DELETE SET NULL, etc.) and if the UUID actually exists.
      # For this test, we are mainly checking if the call runs and `user_id` is passed.
      print(f"Task 3 User ID in DB: {status_report_task3_user.get('user_id')}")
      assert status_report_task3_user.get("status") == "pending_user"

    print("\n--- All tests completed ---")
    print("NOTE: If these tests interact with a real Supabase instance, "
          "they will create/update records in the 'ai_processing_tasks' table.")
    print("Consider cleaning up test data if necessary.")
    
    # Example of how you might clean up created tasks (optional)
    # print(f"\nCleaning up task: {task1_id}")
    # if supabase:
    #     supabase.table("ai_processing_tasks").delete().eq("id", task1_id).execute()
    #     supabase.table("ai_processing_tasks").delete().eq("id", task2_id).execute()
    #     supabase.table("ai_processing_tasks").delete().eq("id", task3_id).execute()
    # print("Cleanup attempted.")
