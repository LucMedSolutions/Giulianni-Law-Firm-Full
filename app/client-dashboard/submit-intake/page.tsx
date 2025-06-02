'use client';

import React, { useState, useEffect } from 'react';
// import { useSearchParams } from 'next/navigation'; // Removed
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Info } from "lucide-react"; // Added Info icon
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Import the form components
import NdaRequestForm from '@/components/intake-forms/NdaRequestForm';
import GeneralConsultationForm from '@/components/intake-forms/GeneralConsultationForm';

import { Case, PageMessage } from '@/types'; // Import Case and PageMessage

type FormType = 'nda_request' | 'general_consultation';

// Case interface is now imported from '@/types'

export default function SubmitIntakePage() {
  const [selectedFormType, setSelectedFormType] = useState<FormType | null>(null);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null); 
  const [pageMessage, setPageMessage] = useState<PageMessage | null>(null); // Use PageMessage interface
  
  const [clientCasesList, setClientCasesList] = useState<Case[]>([]);
  const [loadingClientCases, setLoadingClientCases] = useState<boolean>(true);

  useEffect(() => {
    const fetchClientCases = async () => {
      setLoadingClientCases(true);
      setPageMessage(null); 
      try {
        const response = await fetch('/api/get-client-cases');
        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.details || errorData.error || `Failed to fetch your cases (${response.status})`;
          throw new Error(errorMessage);
        }
        const data: Case[] = await response.json(); // Add type annotation for data
        setClientCasesList(data || []);
        if (!data || data.length === 0) {
          setPageMessage({
            type: 'info',
            text: "No cases found associated with your account. If you need to submit intake for a new matter, please contact us. If you believe this is an error, please also contact support."
          });
        }
      } catch (err: any) {
        console.error("Error fetching client cases:", err);
        setPageMessage({ type: 'error', text: err.message || "An unexpected error occurred while fetching your cases.", details: err.cause?.message });
        setClientCasesList([]);
      } finally {
        setLoadingClientCases(false);
      }
    };
    fetchClientCases();
  }, []); 

  const handleFormSubmitSuccess = (formTypeName: string) => {
    setPageMessage({ type: 'success', text: `${formTypeName} submitted successfully for Case ID: ${currentCaseId}!` });
    setSelectedFormType(null);
    // Optionally, you might want to clear currentCaseId or re-fetch cases if a submission changes case status etc.
    // For now, keeping the case selected.
  };
  
  const handleFormSelect = (formType: FormType) => {
    setSelectedFormType(formType);
    if (pageMessage?.type !== 'error' && !pageMessage?.text.toLowerCase().includes("case")) { // Don't clear case loading errors
        setPageMessage(null);
    }
  };

  const handleCaseSelect = (caseIdValue: string) => {
    if (caseIdValue === "no-selection") { // Add a placeholder/instructional item if needed
        setCurrentCaseId(null);
        setSelectedFormType(null); 
        setPageMessage({type: 'info', text: "Please select a case to proceed."});
    } else {
        setCurrentCaseId(caseIdValue);
        setSelectedFormType(null); 
        setPageMessage(null); 
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 flex flex-col items-center">
      <Card className="w-full max-w-2xl mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Client Intake Center</CardTitle>
          <CardDescription>
            Please select an associated case and then choose the type of intake form you need to submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="case-select-dropdown" className="block mb-2 text-sm font-medium">1. Select Your Case</Label>
            {loadingClientCases ? (
              <p className="text-sm text-muted-foreground">Loading your cases...</p>
            ) : clientCasesList.length > 0 ? (
              <Select 
                value={currentCaseId || ""} 
                onValueChange={handleCaseSelect}
                disabled={loadingClientCases}
              >
                <SelectTrigger id="case-select-dropdown" className="w-full">
                  <SelectValue placeholder="Choose a case..." />
                </SelectTrigger>
                <SelectContent>
                  {clientCasesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number ? `${c.case_number} - ` : ''}{c.client_name || c.case_type || 'Case Details N/A'} (Status: {c.status || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // Rely on pageMessage to display "No cases found" or error messages
              // If !loadingClientCases && clientCasesList.length === 0 && !pageMessage, it means fetch was successful but returned empty.
              // The fetchClientCases function already sets a pageMessage for this.
              null 
            )}
          </div>

          {currentCaseId && (
            <div>
              <Label className="block mb-2 text-sm font-medium">2. Select Form Type</Label>
              <div className="flex flex-col sm:flex-row justify-around space-y-4 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={() => handleFormSelect('nda_request')} 
                  variant={selectedFormType === 'nda_request' ? "default" : "outline"}
                  className="w-full sm:w-auto"
                  disabled={!currentCaseId} // Explicitly disable if no case selected (redundant due to parent block but good practice)
                >
                  NDA Request Form
                </Button>
                <Button 
                  onClick={() => handleFormSelect('general_consultation')} 
                  variant={selectedFormType === 'general_consultation' ? "default" : "outline"}
                  className="w-full sm:w-auto"
                  disabled={!currentCaseId} // Explicitly disable
                >
                  General Consultation Form
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {pageMessage && (
        <Alert 
          variant={pageMessage.type === 'success' ? 'default' : pageMessage.type === 'info' ? 'default' : 'destructive'} 
          className={`mb-6 w-full max-w-2xl 
            ${pageMessage.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700' 
              : pageMessage.type === 'info' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900 dark:border-blue-700' 
              : ''}
          `}
        >
          {pageMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : pageMessage.type === 'info' ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>
            {pageMessage.type === 'success' ? 'Success' 
              : pageMessage.type === 'info' ? (pageMessage.text.toLowerCase().includes("no cases found") ? "No Cases Found" : "Information") 
              : 'Error Occurred'}
          </AlertTitle>
          <AlertDescription>{pageMessage.text}</AlertDescription>
        </Alert>
      )}

      {currentCaseId && selectedFormType && ( 
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>
              {selectedFormType === 'nda_request' ? 'NDA Request Details' : 'General Consultation Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedFormType === 'nda_request' && (
              <NdaRequestForm caseId={currentCaseId} onSubmitSuccess={() => handleFormSubmitSuccess('NDA Request')} />
            )}
            {selectedFormType === 'general_consultation' && (
              <GeneralConsultationForm caseId={currentCaseId} onSubmitSuccess={() => handleFormSubmitSuccess('General Consultation')} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
