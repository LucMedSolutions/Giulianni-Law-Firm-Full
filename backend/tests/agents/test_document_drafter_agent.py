import pytest
from unittest.mock import patch, MagicMock

# Assuming LawFirmCrewRunner is the entry point to access agents
from backend.agents.crew_runner import LawFirmCrewRunner

# Basic Test for Agent Instantiation
def test_document_drafter_agent_instantiation():
    """
    Tests if the DocumentDrafterAgent can be instantiated via LawFirmCrewRunner.
    This test assumes that OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY 
    might be needed for LawFirmCrewRunner initialization. 
    We use patching to avoid actual external calls during this basic test.
    """
    with patch.dict('os.environ', {
        'OPENAI_API_KEY': 'test_key', 
        'SUPABASE_URL': 'http://test.supabase.co', 
        'SUPABASE_SERVICE_KEY': 'test_service_key'
    }):
        try:
            runner = LawFirmCrewRunner()
            # Access the agent instance
            drafter_agent = runner.document_drafter_agent
            assert drafter_agent is not None, "DocumentDrafterAgent should be instantiated."
            assert drafter_agent.role == 'DocumentDrafterAgent', "Agent role is incorrect."
            print("DocumentDrafterAgent instantiated successfully (mocked environment).")
        except Exception as e:
            pytest.fail(f"Failed to instantiate DocumentDrafterAgent even with mocked env: {e}")

# Further tests for the agent's direct methods would go here if it had complex standalone logic.
# However, as its core logic is invoked via a Task within a Crew in run_document_drafting_crew,
# the primary functional testing of the agent's behavior will be within tests for
# the run_document_drafting_crew method in test_crew_runner.py.
