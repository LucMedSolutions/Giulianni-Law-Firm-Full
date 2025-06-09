from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from ..core.config import get_settings

settings = get_settings()

class DatabaseService:
    """Service for database operations."""
    
    def __init__(self):
        """Initialize Supabase client."""
        self.client: Optional[Client] = None
        try:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            raise Exception(f"Failed to initialize Supabase client: {str(e)}")
    
    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('users').select('*').eq('id', user_id).execute()
        if response.data:
            return response.data[0]
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('users').select('*').eq('email', email).execute()
        if response.data:
            return response.data[0]
        return None
    
    async def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new user."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('users').insert(user_data).execute()
        if response.data:
            return response.data[0]
        raise Exception("Failed to create user")
    
    async def update_user(self, user_id: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('users').update(user_data).eq('id', user_id).execute()
        if response.data:
            return response.data[0]
        raise Exception("Failed to update user")
    
    async def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get case by ID."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('cases').select('*').eq('id', case_id).execute()
        if response.data:
            return response.data[0]
        return None
    
    async def get_user_cases(self, user_id: str, role: str) -> List[Dict[str, Any]]:
        """Get cases for a user based on their role."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        if role == "client":
            response = self.client.table('cases').select('*').eq('client_id', user_id).execute()
        elif role == "attorney":
            response = self.client.table('cases').select('*').eq('attorney_id', user_id).execute()
        else:
            response = self.client.table('cases').select('*').execute()
        
        return response.data if response.data else []
    
    async def create_case(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new case."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('cases').insert(case_data).execute()
        if response.data:
            return response.data[0]
        raise Exception("Failed to create case")
    
    async def update_case(self, case_id: str, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update case."""
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('cases').update(case_data).eq('id', case_id).execute()
        if response.data:
            return response.data[0]
        raise Exception("Failed to update case")
    
    async def create_audit_log(self, log_entry: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new audit log entry.
        
        Parameters:
        - log_entry: Dictionary containing audit log data
        
        Returns:
        - Created audit log entry
        """
        if not self.client:
            raise Exception("Database client not initialized")
        
        response = self.client.table('audit_logs').insert(log_entry).execute()
        if response.data:
            return response.data[0]
        raise Exception("Failed to create audit log entry")
    
    async def get_audit_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get audit logs with optional filtering.
        
        Parameters:
        - user_id: Filter by user ID
        - action: Filter by action type
        - resource_type: Filter by resource type
        - start_date: Filter by start date (ISO format)
        - end_date: Filter by end date (ISO format)
        - skip: Number of records to skip
        - limit: Maximum number of records to return
        
        Returns:
        - List of audit log entries
        """
        if not self.client:
            raise Exception("Database client not initialized")
        
        query = self.client.table('audit_logs').select('*')
        
        # Apply filters
        if user_id:
            query = query.eq('user_id', user_id)
        if action:
            query = query.eq('action', action)
        if resource_type:
            query = query.eq('resource_type', resource_type)
        if start_date:
            query = query.gte('timestamp', start_date)
        if end_date:
            query = query.lte('timestamp', end_date)
        
        # Apply pagination
        query = query.range(skip, skip + limit - 1)
        
        # Order by timestamp descending (newest first)
        query = query.order('timestamp', desc=True)
        
        response = query.execute()
        return response.data if response.data else []

# Create global database service instance
db = DatabaseService()