from typing import Dict, Any, Optional
from datetime import datetime
import json
import uuid
from .database import db

class AuditService:
    """Service for audit logging operations."""
    
    async def log_event(self, user_id: str, action: str, resource_type: str, resource_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Log an audit event.
        
        Parameters:
        - user_id: ID of the user performing the action
        - action: Type of action (e.g., 'create', 'update', 'delete', 'view')
        - resource_type: Type of resource being acted upon (e.g., 'case', 'document', 'user')
        - resource_id: Optional ID of the specific resource
        - details: Optional additional details about the action
        
        Returns:
        - The created audit log entry
        """
        # Create audit log entry
        log_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "timestamp": datetime.now().isoformat(),
            "details": json.dumps(details) if details else None,
            "ip_address": None  # Would be set from request in a real implementation
        }
        
        # Store in database
        try:
            created_log = await db.create_audit_log(log_entry)
            return created_log
        except Exception as e:
            # Log error but don't fail the main operation
            print(f"Failed to create audit log: {str(e)}")
            return log_entry
    
    async def get_logs(self, 
                       user_id: Optional[str] = None, 
                       action: Optional[str] = None,
                       resource_type: Optional[str] = None,
                       start_date: Optional[str] = None,
                       end_date: Optional[str] = None,
                       skip: int = 0,
                       limit: int = 100) -> list:
        """
        Get audit logs with optional filtering.
        
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
        try:
            logs = await db.get_audit_logs(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                start_date=start_date,
                end_date=end_date,
                skip=skip,
                limit=limit
            )
            
            # Parse JSON details if present
            for log in logs:
                if log.get("details") and isinstance(log["details"], str):
                    try:
                        log["details"] = json.loads(log["details"])
                    except json.JSONDecodeError:
                        # Keep as string if not valid JSON
                        pass
            
            return logs
        except Exception as e:
            print(f"Failed to get audit logs: {str(e)}")
            return []
    
    async def export_logs(self,
                         user_id: Optional[str] = None, 
                         action: Optional[str] = None,
                         resource_type: Optional[str] = None,
                         start_date: Optional[str] = None,
                         end_date: Optional[str] = None) -> str:
        """
        Export audit logs to CSV format.
        
        Parameters:
        - user_id: Filter by user ID
        - action: Filter by action type
        - resource_type: Filter by resource type
        - start_date: Filter by start date (ISO format)
        - end_date: Filter by end date (ISO format)
        
        Returns:
        - CSV string of audit logs
        """
        try:
            # Get all matching logs (no pagination for export)
            logs = await self.get_logs(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                start_date=start_date,
                end_date=end_date,
                limit=10000  # Set a reasonable limit
            )
            
            if not logs:
                return "No logs found"
            
            # Create CSV header
            csv_lines = ["id,user_id,action,resource_type,resource_id,timestamp,details,ip_address"]
            
            # Add log entries
            for log in logs:
                # Format details as escaped JSON string
                details_str = '"' + json.dumps(log.get("details", {})).replace('"', '""') + '"' if log.get("details") else """"
                
                csv_lines.append(f"{log.get('id', '')},{log.get('user_id', '')},{log.get('action', '')},{log.get('resource_type', '')},{log.get('resource_id', '')},{log.get('timestamp', '')},{details_str},{log.get('ip_address', '')}")
            
            return "\n".join(csv_lines)
        except Exception as e:
            print(f"Failed to export audit logs: {str(e)}")
            return "Error exporting logs"

# Create global audit service instance
audit = AuditService()