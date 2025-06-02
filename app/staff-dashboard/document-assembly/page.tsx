'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For errors/status
import { AlertCircle, CheckCircle2 } from "lucide-react"; // Icons for alerts
import { Case } from '@/types'; // Import shared Case type
import { 
    ClientIntakeData, 
    Template, 
    DocumentTaskStatusResponse, 
    DocumentTaskResult,
    TaskStatus // Ensure TaskStatus is exported from types/document-assembly.ts
} from '@/types/document-assembly'; // Import types for document assembly
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Case, ClientIntakeData, Template are now imported

// Simulate a feature flag
const FEATURE_AI_DOC_ASSEMBLY_ENABLED = true; // Set to false to test disabled state

const staticTemplates: Template[] = [
  { 
    id: 'nda_template.jinja2', 
    name: 'Non-Disclosure Agreement (NDA)',
    description: 'Generates a standard Non-Disclosure Agreement. Key fields usually include Disclosing Party, Receiving Party, Effective Date, and Purpose of disclosure.'
  },
  { 
    id: 'letter_template.jinja2', 
    name: 'General Client Letter',
    description: 'Creates a general-purpose letter to a client or other party. Requires recipient details, subject, and the main body content.'
  },
  // Add more templates here with their descriptions as they become available
];

export default function DocumentAssemblyPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [clientIntakeData, setClientIntakeData] = useState<ClientIntakeData | null>(null);
  const [operatorInstructions, setOperatorInstructions] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTaskStatus, setCurrentTaskStatus] = useState<TaskStatus | null>(null); // Use imported TaskStatus
  const [taskResult, setTaskResult] = useState<DocumentTaskResult | null>(null); // Use imported DocumentTaskResult

  const [loadingCases, setLoadingCases] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false); 
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isFetchingSignedUrl, setIsFetchingSignedUrl] = useState<boolean>(false);
  
  const [casesList, setCasesList] = useState<Case[]>([]);
  const [templatesList] = useState<Template[]>(staticTemplates); 

  useEffect(() => {
    console.log("DocumentAssemblyPage: Component mounted. Fetching initial cases.");
    const fetchCases = async () => {
      setLoadingCases(true);
      setErrorMessage(null);
      console.log("DocumentAssemblyPage: Initiating fetch for staff cases.");
      try {
        const response = await fetch('/api/get-cases-for-staff');
        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error || `Failed to fetch cases: ${response.statusText}`;
          console.error("DocumentAssemblyPage: Error fetching cases:", errorMsg, response.status);
          throw new Error(errorMsg);
        }
        const data: Case[] = await response.json();
        console.log("DocumentAssemblyPage: Successfully fetched cases:", data.length);
        setCasesList(data);
      } catch (error: any) {
        console.error("DocumentAssemblyPage: Exception during fetchCases:", error.message);
        setErrorMessage(error.message || "An unknown error occurred while fetching cases.");
        setCasesList([]);
      } finally {
        setLoadingCases(false);
        console.log("DocumentAssemblyPage: Finished fetching cases attempt.");
      }
    };
    fetchCases();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      console.log("DocumentAssemblyPage: No case selected, clearing client intake data.");
      setClientIntakeData(null);
      return;
    }
    console.log(`DocumentAssemblyPage: Case selected (ID: ${selectedCaseId}). Fetching client intake data.`);
    const fetchClientIntakeData = async () => {
      setLoadingData(true);
      setClientIntakeData(null);
      setErrorMessage(null);
      console.log(`DocumentAssemblyPage: Initiating fetch for intake data for case ID: ${selectedCaseId}.`);
      try {
        const response = await fetch(`/api/get-client-intake-data?case_id=${selectedCaseId}`);
        if (response.ok) {
          const data: ClientIntakeData = await response.json();
          console.log(`DocumentAssemblyPage: Successfully fetched intake data for case ID: ${selectedCaseId}.`, data);
          setClientIntakeData(data);
        } else if (response.status === 404) {
          console.warn(`DocumentAssemblyPage: No client intake data found (404) for case ID: ${selectedCaseId}.`);
          setClientIntakeData(null);
          setErrorMessage(`No client intake data found for case ID: ${selectedCaseId}.`);
        } else {
          const errorData = await response.json();
          const errorMsg = errorData.error || `Failed to fetch client intake data: ${response.statusText}`;
          console.error(`DocumentAssemblyPage: Error fetching intake data for case ID: ${selectedCaseId}:`, errorMsg, response.status);
          throw new Error(errorMsg);
        }
      } catch (error: any) {
        console.error(`DocumentAssemblyPage: Exception during fetchClientIntakeData for case ID: ${selectedCaseId}:`, error.message);
        setClientIntakeData(null);
        setErrorMessage(error.message || "An unknown error occurred while fetching client intake data.");
      } finally {
        setLoadingData(false);
        console.log(`DocumentAssemblyPage: Finished fetching intake data attempt for case ID: ${selectedCaseId}.`);
      }
    };
    fetchClientIntakeData();
  }, [selectedCaseId]);

  const handleGenerateDocument = async () => {
    console.log("DocumentAssemblyPage: handleGenerateDocument called.");
    setErrorMessage(null);
    setStatusMessage(null);
    setTaskId(null);
    setCurrentTaskStatus(null);
    setTaskResult(null);
    setIsGenerating(true);

    if (!selectedCaseId || !operatorInstructions.trim() || !selectedTemplateId) {
      const missingFieldsMsg = "Validation Error: Please select a case, enter instructions, and choose a template.";
      console.warn("DocumentAssemblyPage: Validation failed for document generation.", { selectedCaseId, operatorInstructionsTrimmed: operatorInstructions.trim() === '', selectedTemplateId });
      setErrorMessage(missingFieldsMsg);
      setIsGenerating(false);
      return;
    }

    const supabase = createClientComponentClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      const authErrorMsg = "Authentication error: User not found. Please log in again.";
      console.error("DocumentAssemblyPage: User not authenticated for document generation.");
      setErrorMessage(authErrorMsg);
      setIsGenerating(false);
      return;
    }

    const requestBody = {
      case_id: selectedCaseId,
      operator_instructions: operatorInstructions,
      template_id: selectedTemplateId,
      user_id: userId,
    };

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      const backendUrlErrorMsg = "Configuration Error: Backend API URL is not configured. Please contact support.";
      console.error("DocumentAssemblyPage:", backendUrlErrorMsg);
      setErrorMessage(backendUrlErrorMsg);
      setIsGenerating(false);
      return;
    }

    console.log("DocumentAssemblyPage: Initiating document generation API call to /generate-document/ with payload:", JSON.stringify(requestBody, null, 2));
    try {
      const response = await fetch(`${backendUrl}/generate-document/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const responseData: DocumentTaskStatusResponse | { detail?: string, error?: string } = await response.json(); // Type adjustment
      
      if (response.ok && response.status === 202 && 'task_id' in responseData && responseData.task_id) {
        console.log("DocumentAssemblyPage: Document generation successfully queued. Task ID:", responseData.task_id);
        setTaskId(responseData.task_id);
        setStatusMessage(`Document generation queued. Task ID: ${responseData.task_id}. Polling for status...`);
        setCurrentTaskStatus('pending'); // Set initial status
      } else {
        const errorDetail = (responseData as any).detail || (responseData as any).error || response.statusText || 'Unknown server error';
        console.error("DocumentAssemblyPage: Failed to start document generation. Status:", response.status, "Response:", responseData);
        setErrorMessage(`Failed to start document generation: ${errorDetail}`);
      }
    } catch (error: any) {
      console.error("DocumentAssemblyPage: Exception during /generate-document/ API call:", error.message, error);
      setErrorMessage(`An unexpected error occurred while initiating generation: ${error.message || "Unknown error"}`);
    } finally {
      setIsGenerating(false);
      console.log("DocumentAssemblyPage: Finished document generation attempt.");
    }
  };
  
  const isGenerateButtonDisabled = isGenerating || !selectedCaseId || !selectedTemplateId || loadingData || !operatorInstructions.trim();

  const fetchTaskStatus = async (currentTaskId: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.error("DocumentAssemblyPage: Backend API URL not configured. Cannot fetch task status.");
      setErrorMessage("Backend API URL is not configured. Cannot fetch task status.");
      setCurrentTaskStatus('error');
      return true;
    }
    const url = `${backendUrl}/agent-status/?task_id=${currentTaskId}`;
    console.log(`DocumentAssemblyPage: Polling for task status. Task ID: ${currentTaskId}, URL: ${url}`);
    try {
      const response = await fetch(url);
      const responseData: DocumentTaskStatusResponse = await response.json(); // Assume this is the shape

      if (!response.ok) {
        let errorDetail = responseData.details || responseData.message || responseData.error_message || response.statusText;
        console.error(`DocumentAssemblyPage: Error fetching status for task ${currentTaskId}. Status: ${response.status}`, responseData);
        setErrorMessage(`Error fetching status (${response.status}): ${errorDetail}`);
        setCurrentTaskStatus('error');
        return true;
      }
      
      console.log(`DocumentAssemblyPage: Received task status for ${currentTaskId}:`, responseData.status, "Full response:", responseData);
      setCurrentTaskStatus(responseData.status);
      
      const backendMessage = responseData.message || (responseData.status === 'completed' && responseData.result?.file_name ? `Document ${responseData.result.file_name} ready.` : '');
      setStatusMessage(`Task status: ${responseData.status}${backendMessage ? ` - ${backendMessage}` : ''}`);

      if (responseData.status === 'completed') {
        console.log(`DocumentAssemblyPage: Task ${currentTaskId} completed. Result:`, responseData.result);
        setTaskResult(responseData.result || null);
        return true;
      } else if (responseData.status === 'error') {
        const errorMsg = responseData.error_message || responseData.details || responseData.message || 'Unknown task error';
        console.error(`DocumentAssemblyPage: Task ${currentTaskId} failed with error:`, errorMsg, "Full response:", responseData);
        setErrorMessage(`Task failed: ${errorMsg}`);
        return true;
      } else if (responseData.status === 'not_found') {
        console.warn(`DocumentAssemblyPage: Task ID ${currentTaskId} not found by server. Polling stopped.`);
        setErrorMessage(`Task ID ${currentTaskId} not found. Polling stopped.`);
        return true;
      }
      return false; // Continue polling
    } catch (error: any) {
      console.error(`DocumentAssemblyPage: Network or JSON parsing error while polling for task ${currentTaskId}:`, error.message, error);
      setErrorMessage("Network error while polling for task status. Polling stopped.");
      setCurrentTaskStatus('error');
      return true;
    }
  };

  useEffect(() => {
    if (!taskId || ['completed', 'error', 'not_found'].includes(currentTaskStatus || '')) {
      if (taskId) console.log(`DocumentAssemblyPage: Polling conditions not met or task terminal. TaskId: ${taskId}, Status: ${currentTaskStatus}. Clearing interval.`);
      return;
    }
    
    console.log(`DocumentAssemblyPage: Starting polling for Task ID: ${taskId}. Current status: ${currentTaskStatus}`);
    const intervalId = setInterval(async () => {
      console.log(`DocumentAssemblyPage: Interval: Polling for task ${taskId}.`);
      const shouldStop = await fetchTaskStatus(taskId);
      if (shouldStop) {
        console.log(`DocumentAssemblyPage: Interval: Polling determined to stop for task ${taskId}. Clearing interval.`);
        clearInterval(intervalId);
      }
    }, 3000);
    
    return () => {
      console.log(`DocumentAssemblyPage: useEffect cleanup for Task ID: ${taskId}. Clearing interval.`);
      clearInterval(intervalId);
    };
  }, [taskId, currentTaskStatus]);

  const handleDocumentAction = async (action: 'view' | 'download') => {
    console.log(`DocumentAssemblyPage: handleDocumentAction called for action: ${action}. Task result:`, taskResult);
    setIsFetchingSignedUrl(true);
    setErrorMessage(null);

    if (!taskResult || !taskResult.storage_path || !taskResult.bucket_name) {
      const errorMsg = "Document information (storage_path or bucket_name) is missing in task result. Cannot perform action.";
      console.error("DocumentAssemblyPage:", errorMsg, taskResult);
      setErrorMessage(errorMsg);
      setIsFetchingSignedUrl(false);
      return;
    }

    const { storage_path, bucket_name } = taskResult;
    console.log(`DocumentAssemblyPage: Fetching signed URL for storage_path: ${storage_path}, bucket_name: ${bucket_name}`);
    try {
      const response = await fetch(`/api/get-signed-document-url?storage_path=${encodeURIComponent(storage_path)}&bucket_name=${encodeURIComponent(bucket_name)}`);
      const data = await response.json();
      if (response.ok && data.signedUrl) {
        console.log(`DocumentAssemblyPage: Successfully fetched signed URL for ${action}:`, data.signedUrl);
        window.open(data.signedUrl, '_blank');
      } else {
        const errorMsg = data.error || "Failed to get document URL from API.";
        console.error("DocumentAssemblyPage: Error response from /api/get-signed-document-url:", errorMsg, data);
        setErrorMessage(errorMsg);
      }
    } catch (error: any) {
      console.error("DocumentAssemblyPage: Exception during /api/get-signed-document-url call:", error.message, error);
      setErrorMessage(`Error fetching document URL: ${error.message || "Unknown error"}`);
    } finally {
      setIsFetchingSignedUrl(false);
      console.log(`DocumentAssemblyPage: Finished handleDocumentAction attempt for action: ${action}.`);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Document Assembly</CardTitle>
          <CardDescription>
            Select a case, provide instructions, choose a template, and generate a new document.
            {!FEATURE_AI_DOC_ASSEMBLY_ENABLED && " (Note: AI Document Assembly is currently disabled)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!FEATURE_AI_DOC_ASSEMBLY_ENABLED ? (
            <Alert variant="info">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Feature Disabled</AlertTitle>
              <AlertDescription>
                AI-powered document assembly is currently unavailable. Please check back later or contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Case Selection */}
              <div className="space-y-2">
                <Label htmlFor="case-select">1. Select Case</Label>
                {loadingCases && <p className="text-sm text-gray-500">Loading cases...</p>}
                {!loadingCases && casesList.length === 0 && !errorMessage && (
                  <p className="text-sm text-gray-500">No cases found or assigned to you.</p>
                )}
                {!loadingCases && errorMessage && !clientIntakeData && !loadingData && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Cases</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                {!loadingCases && casesList.length > 0 && (
                  <Select
                    value={selectedCaseId}
                    onValueChange={(value) => {
                      console.log("DocumentAssemblyPage: Case selected from dropdown:", value);
                      setSelectedCaseId(value);
                      setErrorMessage(null); // Clear previous errors on new selection
                    }}
                    disabled={isGenerating || loadingCases}
                  >
                    <SelectTrigger id="case-select">
                      <SelectValue placeholder="Select a case..." />
                    </SelectTrigger>
                    <SelectContent>
                      {casesList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.case_number ? `${c.case_number} - ` : ''}{c.client_name || 'N/A'} (Status: {c.status || 'N/A'}, Type: {c.case_type || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Client Intake Data Display */}
              <div className="space-y-2">
                <Label>2. Client Intake Data (Read-only)</Label>
                {!selectedCaseId ? (
                  <p className="text-sm text-gray-500">Select a case to view its intake data.</p>
                ) : loadingData ? (
                  <p className="text-sm text-gray-500">Loading client data...</p>
                ) : errorMessage && !clientIntakeData && selectedCaseId ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Client Data</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : clientIntakeData ? (
                  <Card className="bg-slate-50 dark:bg-slate-800">
                    <CardContent className="p-4 max-h-60 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap">
                        {JSON.stringify(clientIntakeData, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert variant="info" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Client Intake Data</AlertTitle>
                    <AlertDescription>
                      No specific client intake data found for the selected case.
                      The document will be generated based on the template defaults and your instructions.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="operator-instructions">3. Operator Instructions</Label>
                <Textarea
                  id="operator-instructions"
                  placeholder="Enter any specific instructions for the document generation..."
                  value={operatorInstructions}
                  onChange={(e) => setOperatorInstructions(e.target.value)}
                  rows={4}
                  disabled={isGenerating}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-select">4. Select Document Template</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    console.log("DocumentAssemblyPage: Template selected:", value);
                    setSelectedTemplateId(value);
                  }}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesList.map((template) => (
                      <TooltipProvider key={template.id} delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SelectItem value={template.id}>
                              {template.name}
                            </SelectItem>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="start" className="max-w-xs bg-background border text-foreground shadow-lg p-3 rounded-md">
                            <p className="font-medium text-sm mb-1">{template.name}</p>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
        {FEATURE_AI_DOC_ASSEMBLY_ENABLED && (
          <CardFooter className="flex flex-col items-start space-y-4">
            <Button 
              onClick={handleGenerateDocument} 
              disabled={isGenerateButtonDisabled}
              className="w-full md:w-auto"
            >
              {isGenerating ? "Generating..." : "Generate Document"}
            </Button>
            
            {taskId && statusMessage && !errorMessage && currentTaskStatus !== 'completed' && currentTaskStatus !== 'error' && (
              <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900 dark:border-blue-700">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">
                  Task Status: {currentTaskStatus ? currentTaskStatus.replace('_', ' ').toUpperCase() : 'SUBMITTED'}
                </AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                  {statusMessage}
                </AlertDescription>
              </Alert>
            )}

            {currentTaskStatus === 'completed' && taskResult && (
              <Alert variant="success" className="mt-4 bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-700 dark:text-green-300">Generation Completed!</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-400">
                  {statusMessage}
                  {taskResult?.file_name && <p className="my-2">Generated document: <strong>{taskResult.file_name}</strong></p>}
                  <div className="mt-3 flex space-x-2">
                    <Button 
                      onClick={() => handleDocumentAction('view')} 
                      disabled={isFetchingSignedUrl || !taskResult?.storage_path || !taskResult?.bucket_name}
                      size="sm"
                    >
                      {isFetchingSignedUrl ? 'Loading URL...' : 'View Document'}
                    </Button>
                    <Button 
                      onClick={() => handleDocumentAction('download')} 
                      disabled={isFetchingSignedUrl || !taskResult?.storage_path || !taskResult?.bucket_name}
                      variant="outline"
                      size="sm"
                    >
                      {isFetchingSignedUrl ? 'Loading URL...' : 'Download Document'}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && ( 
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Occurred</AlertTitle>
                <AlertDescription>
                  {errorMessage}
                  {currentTaskStatus === 'error' && taskId && (
                    <Button 
                      onClick={handleGenerateDocument} 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      disabled={isGenerating} 
                    >
                      {isGenerating && statusMessage?.includes(taskId) ? 'Retrying...' : 'Retry Generation'}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
