'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface NdaRequestFormValues {
  disclosing_party_name: string;
  disclosing_party_address: string;
  receiving_party_name: string;
  receiving_party_address: string;
  effective_date: string;
  purpose_of_nda: string;
  definition_of_confidential_information: string;
}

const initialNdaFormData: NdaRequestFormValues = {
  disclosing_party_name: '',
  disclosing_party_address: '',
  receiving_party_name: '',
  receiving_party_address: '',
  effective_date: '',
  purpose_of_nda: '',
  definition_of_confidential_information: '',
};

interface NdaRequestFormProps {
  caseId: string;
  onSubmitSuccess?: (formType: string) => void;
}

export default function NdaRequestForm({ caseId, onSubmitSuccess }: NdaRequestFormProps) {
  const [formData, setFormData] = useState<NdaRequestFormValues>(initialNdaFormData);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    if (!caseId) {
        setSubmitStatus({type: 'error', message: 'Error: Case ID is missing. Cannot submit form.'});
        setIsSubmitting(false);
        return;
    }

    const payload = {
      case_id: caseId,
      form_type: 'nda_request' as const,
      formData: formData,
    };

    try {
      const response = await fetch('/api/submit-client-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        setSubmitStatus({ type: 'success', message: responseData.message || 'NDA Request form submitted successfully!' });
        setFormData(initialNdaFormData); // Reset form
        if (onSubmitSuccess) {
          onSubmitSuccess('NDA Request');
        }
      } else {
        if (responseData.details && typeof responseData.details === 'object' && !Array.isArray(responseData.details)) {
            const errorMessages = Object.entries(responseData.details)
                .map(([field, errors]: [string, any]) => `${field}: ${(errors as string[]).join(', ')}`)
                .join('; ');
            setSubmitStatus({ type: 'error', message: `Validation failed: ${errorMessages}` });
        } else {
            setSubmitStatus({ type: 'error', message: responseData.error || responseData.details || 'Failed to submit NDA Request form.' });
        }
      }
    } catch (error: any) {
      console.error("Error submitting NDA Request form:", error);
      setSubmitStatus({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Disclosing Party */}
      <fieldset className="space-y-3 border p-4 rounded-md">
        <legend className="text-lg font-medium px-1">Disclosing Party</legend>
        <div className="space-y-2">
          <Label htmlFor="disclosing_party_name">Name</Label>
          <Input id="disclosing_party_name" name="disclosing_party_name" value={formData.disclosing_party_name} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., Your Company Name / Your Full Name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disclosing_party_address">Address</Label>
          <Input id="disclosing_party_address" name="disclosing_party_address" value={formData.disclosing_party_address} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., 123 Main St, Anytown, USA" />
        </div>
      </fieldset>

      {/* Receiving Party */}
      <fieldset className="space-y-3 border p-4 rounded-md">
        <legend className="text-lg font-medium px-1">Receiving Party</legend>
        <div className="space-y-2">
          <Label htmlFor="receiving_party_name">Name</Label>
          <Input id="receiving_party_name" name="receiving_party_name" value={formData.receiving_party_name} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., Other Party's Company Name / Full Name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receiving_party_address">Address</Label>
          <Input id="receiving_party_address" name="receiving_party_address" value={formData.receiving_party_address} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., 456 Oak Ave, Otherville, USA" />
        </div>
      </fieldset>

      {/* Agreement Details */}
      <fieldset className="space-y-3 border p-4 rounded-md">
        <legend className="text-lg font-medium px-1">Agreement Details</legend>
        <div className="space-y-2">
          <Label htmlFor="effective_date">Effective Date</Label>
          <Input id="effective_date" name="effective_date" type="date" value={formData.effective_date} onChange={handleChange} required disabled={isSubmitting} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purpose_of_nda">Purpose of NDA</Label>
          <Textarea id="purpose_of_nda" name="purpose_of_nda" value={formData.purpose_of_nda} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., To discuss potential business collaboration, evaluate software..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="definition_of_confidential_information">Definition of Confidential Information</Label>
          <Textarea id="definition_of_confidential_information" name="definition_of_confidential_information" value={formData.definition_of_confidential_information} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., Any and all technical, business, financial information..." />
        </div>
      </fieldset>
      
      {submitStatus && (
        <Alert variant={submitStatus.type === 'success' ? 'default' : 'destructive'} className={`mt-4 ${submitStatus.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700' : ''}`}>
          {submitStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{submitStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{submitStatus.message}</AlertDescription>
        </Alert>
      )}
      
      <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
        {isSubmitting ? 'Submitting...' : 'Submit NDA Request'}
      </Button>
    </form>
  );
}
