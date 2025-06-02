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

interface Case {
  id: string;
  case_number?: string;
  client_name?: string;
  status?: string; 
  case_type?: string; 
}

interface ClientIntakeData {
  [key: string]: any; 
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added for tooltips

interface Template {
  id: string;
  name: string;
  description: string; // Added description field
}

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
  const [currentTaskStatus, setCurrentTaskStatus] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<any | null>(null);

  const [loadingCases, setLoadingCases] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false); 
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isFetchingSignedUrl, setIsFetchingSignedUrl] = useState<boolean>(false);
  
  const [casesList, setCasesList] = useState<Case[]>([]);
  const [templatesList] = useState<Template[]>(staticTemplates); 

  useEffect(() => {
    const fetchCases = async () => {
      setLoadingCases(true);
      setErrorMessage(null); 
      try {
        const response = await fetch('/api/get-cases-for-staff');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch cases: ${response.statusText}`);
        }
        const data: Case[] = await response.json();
        setCasesList(data);
      } catch (error: any) {
        console.error("Error fetching cases:", error);
        setErrorMessage(error.message || "An unknown error occurred while fetching cases.");
        setCasesList([]); 
      } finally {
        setLoadingCases(false);
      }
    };
    fetchCases();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      setClientIntakeData(null);
      return;
    }
    const fetchClientIntakeData = async () => {
      setLoadingData(true);
      setClientIntakeData(null); 
      setErrorMessage(null); 
      try {
        const response = await fetch(`/api/get-client-intake-data?case_id=${selectedCaseId}`);
        if (response.ok) {
          const data: ClientIntakeData = await response.json();
          setClientIntakeData(data);
        } else if (response.status === 404) {
          setClientIntakeData(null);
          setErrorMessage(`No client intake data found for case ID: ${selectedCaseId}.`);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch client intake data: ${response.statusText}`);
        }
      } catch (error: any) {
        console.error("Error fetching client intake data:", error);
        setClientIntakeData(null);
        setErrorMessage(error.message || "An unknown error occurred while fetching client intake data.");
      } finally {
        setLoadingData(false);
      }
    };
    fetchClientIntakeData();
  }, [selectedCaseId]);

  const handleGenerateDocument = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setTaskId(null);
    setCurrentTaskStatus(null);
    setTaskResult(null);
    setIsGenerating(true);

    if (!selectedCaseId || !operatorInstructions.trim() || !selectedTemplateId) {
      setErrorMessage("Please select a case, enter instructions, and choose a template.");
      setIsGenerating(false);
      return;
    }

    const supabase = createClientComponentClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      setErrorMessage("Authentication error: User not found. Please log in again.");
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
      setErrorMessage("Backend API URL is not configured. Please contact support.");
      setIsGenerating(false);
      return;
    }

    try {
      console.log("Calling /generate-document/ with body:", JSON.stringify(requestBody, null, 2));
      const response = await fetch(`${backendUrl}/generate-document/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const responseData = await response.json();
      if (response.ok && response.status === 202) {
        setTaskId(responseData.task_id);
        setStatusMessage(`Document generation queued. Task ID: ${responseData.task_id}. You can now poll for status or wait for completion notification.`);
      } else {
        setErrorMessage(`Failed to start document generation: ${responseData.detail || responseData.error || response.statusText || 'Unknown server error'}`);
      }
    } catch (error: any) {
      console.error("Error calling generate-document API:", error);
      setErrorMessage(`An unexpected error occurred: ${error.message || "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isGenerateButtonDisabled = isGenerating || !selectedCaseId || !selectedTemplateId || loadingData || !operatorInstructions.trim();

  const fetchTaskStatus = async (currentTaskId: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      setErrorMessage("Backend API URL is not configured. Cannot fetch task status.");
      setCurrentTaskStatus('error'); 
      return true; 
    }
    const url = `${backendUrl}/agent-status/?task_id=${currentTaskId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorData.error || errorDetail;
        } catch (jsonError) { /* Ignore */ }
        setErrorMessage(`Error fetching status (${response.status}): ${errorDetail}`);
        setCurrentTaskStatus('error'); 
        return true; 
      }
      const responseData = await response.json();
      setCurrentTaskStatus(responseData.status);
      const backendMessage = responseData.message || responseData.details || (responseData.status === 'completed' && responseData.result?.filename ? `Document ${responseData.result.filename} ready.` : '');
      setStatusMessage(`Task status: ${responseData.status}${backendMessage ? ` - ${backendMessage}` : ''}`);
      if (responseData.status === 'completed') {
        setTaskResult(responseData.result || responseData.details); 
        return true; 
      } else if (responseData.status === 'error') {
        const errorMsg = responseData.error_message || responseData.details?.error_message || responseData.message || 'Unknown task error';
        setErrorMessage(`Task failed: ${errorMsg}`);
        return true; 
      } else if (responseData.status === 'not_found') {
        setErrorMessage(`Task ID ${currentTaskId} not found. Polling stopped.`);
        return true; 
      }
      return false; 
    } catch (error: any) {
      console.error("Polling error:", error);
      setErrorMessage("Network error while polling for task status. Polling stopped.");
      setCurrentTaskStatus('error'); 
      return true; 
    }
  };

  useEffect(() => {
    if (!taskId || currentTaskStatus === 'completed' || currentTaskStatus === 'error' || currentTaskStatus === 'not_found') {
      return; 
    }
    const intervalId = setInterval(async () => {
      const shouldStop = await fetchTaskStatus(taskId);
      if (shouldStop) {
        clearInterval(intervalId);
      }
    }, 3000); 
    return () => clearInterval(intervalId);
  }, [taskId, currentTaskStatus]); 

  const handleDocumentAction = async (action: 'view' | 'download') => {
    setIsFetchingSignedUrl(true);
    setErrorMessage(null); 
    if (!taskResult || !taskResult.storage_path || !taskResult.bucket_name) {
      setErrorMessage("Document information is missing in task result. Cannot perform action.");
      setIsFetchingSignedUrl(false);
      return;
    }
    const { storage_path, bucket_name } = taskResult;
    try {
      const response = await fetch(`/api/get-signed-document-url?storage_path=${encodeURIComponent(storage_path)}&bucket_name=${encodeURIComponent(bucket_name)}`);
      const data = await response.json();
      if (response.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        setErrorMessage(data.error || "Failed to get document URL.");
      }
    } catch (error: any) {
      setErrorMessage(`Error fetching document URL: ${error.message || "Unknown error"}`);
      console.error("Error in handleDocumentAction:", error);
    } finally {
      setIsFetchingSignedUrl(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Document Assembly</CardTitle>
          <CardDescription>
            Select a case, provide instructions, choose a template, and generate a new document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Case Selection */}
          <div className="space-y-2">
            <Label htmlFor="case-select">1. Select Case</Label>
            {loadingCases && <p className="text-sm text-gray-500">Loading cases...</p>}
            {!loadingCases && casesList.length === 0 && !errorMessage && (
              <p className="text-sm text-gray-500">No cases found or assigned to you.</p>
            )}
            {/* Display general error message if it's about case loading and not overridden by client data specific error */}
            {!loadingCases && errorMessage && !clientIntakeData && !loadingData &&( 
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
                  setSelectedCaseId(value);
                  setErrorMessage(null); 
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
              onValueChange={(value) => setSelectedTemplateId(value)}
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
                        {/* Wrapping SelectItem directly with TooltipTrigger asChild might be tricky
                            if SelectItem itself has complex event handling or structure.
                            A common pattern is to ensure the child of TooltipTrigger is a simple, single element.
                            If SelectItem does not forward its ref or has internal complexity, this might not work as expected.
                            An alternative would be to put an info icon inside the SelectItem and attach tooltip to that.
                            For this attempt, we try wrapping SelectItem directly.
                        */}
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
        </CardContent>
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
      </Card>
    </div>
  );
}
