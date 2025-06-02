'use client';

import React, { useState, useEffect } from 'react';
import { z, ZodError } from 'zod'; // Import Zod
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { NdaRequestFormValues } from '@/types/forms'; // Import the interface

// NdaRequestFormValues is now imported from '@/types/forms'

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

// Zod Schema for client-side validation for NDA Request
const NdaRequestClientSchema = z.object({
  disclosing_party_name: z.string().min(1, "Disclosing party name is required."),
  disclosing_party_address: z.string().min(1, "Disclosing party address is required."),
  receiving_party_name: z.string().min(1, "Receiving party name is required."),
  receiving_party_address: z.string().min(1, "Receiving party address is required."),
  effective_date: z.string().min(1, "Effective date is required.") // Basic check, could be refined for valid date format
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be in YYYY-MM-DD format."), // Example regex for date format
  purpose_of_nda: z.string().min(10, "Purpose must be at least 10 characters."),
  definition_of_confidential_information: z.string().min(10, "Definition must be at least 10 characters."),
});

// Type for individual field errors
type FormErrorsNda = {
  [K in keyof NdaRequestFormValues]?: string[];
};

export default function NdaRequestForm({ caseId, onSubmitSuccess }: NdaRequestFormProps) {
  const [formData, setFormData] = useState<NdaRequestFormValues>(initialNdaFormData);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrorsNda>({});

  // Clear errors for a field when it's changed (basic implementation)
  useEffect(() => {
    if (Object.keys(formErrors).length > 0) {
      // Simple clear all, could be more specific
    }
  }, [formData, formErrors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({}); // Clear previous form errors
    setSubmitStatus(null); // Clear previous submission status

    // Client-side validation
    const validationResult = NdaRequestClientSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: FormErrorsNda = {};
      validationResult.error.errors.forEach(err => {
        const path = err.path[0] as keyof NdaRequestFormValues;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path]?.push(err.message);
      });
      setFormErrors(fieldErrors);
      setSubmitStatus({ type: 'error', message: 'Please correct the errors in the form.' });
      setIsSubmitting(false);
      return;
    }
    
    setIsSubmitting(true); // Set submitting state only after validation passes

    if (!caseId) {
        setSubmitStatus({type: 'error', message: 'Error: Case ID is missing. Cannot submit form.'});
        setIsSubmitting(false);
        return;
    }

    const payload = {
      case_id: caseId, // Already validated by parent component
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
            // Server-side Zod errors
            const serverFieldErrors: FormErrorsNda = {};
            let generalErrorMessage = 'Submission failed due to validation errors: ';
            const errorDetails: string[] = [];

            Object.entries(responseData.details).forEach(([field, errors]) => {
                const key = field as keyof NdaRequestFormValues;
                serverFieldErrors[key] = (errors as string[]);
                errorDetails.push(`${field}: ${(errors as string[]).join(', ')}`);
            });
            setFormErrors(prevErrors => ({...prevErrors, ...serverFieldErrors}));
            setSubmitStatus({ type: 'error', message: generalErrorMessage + errorDetails.join('; ') });
        } else {
            // Other server errors
            setSubmitStatus({ type: 'error', message: responseData.error || responseData.details || 'Failed to submit NDA Request form.' });
        }
      }
    } catch (error: any) {
      console.error("Error submitting NDA Request form:", error);
      if (error instanceof ZodError) { // Should ideally be caught by safeParse
        const fieldErrors: FormErrorsNda = {};
        error.errors.forEach(err => {
            const path = err.path[0] as keyof NdaRequestFormValues;
            if (!fieldErrors[path]) { fieldErrors[path] = []; }
            fieldErrors[path]?.push(err.message);
        });
        setFormErrors(fieldErrors);
        setSubmitStatus({ type: 'error', message: 'Please correct the highlighted errors.' });
      } else {
        setSubmitStatus({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
      }
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
          <Input id="disclosing_party_name" name="disclosing_party_name" value={formData.disclosing_party_name} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., Your Company Name / Your Full Name" aria-describedby="disclosing_party_name_error" />
          {formErrors.disclosing_party_name && <p id="disclosing_party_name_error" className="text-sm text-red-600 mt-1">{formErrors.disclosing_party_name.join(', ')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="disclosing_party_address">Address</Label>
          <Input id="disclosing_party_address" name="disclosing_party_address" value={formData.disclosing_party_address} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., 123 Main St, Anytown, USA" aria-describedby="disclosing_party_address_error" />
          {formErrors.disclosing_party_address && <p id="disclosing_party_address_error" className="text-sm text-red-600 mt-1">{formErrors.disclosing_party_address.join(', ')}</p>}
        </div>
      </fieldset>

      {/* Receiving Party */}
      <fieldset className="space-y-3 border p-4 rounded-md">
        <legend className="text-lg font-medium px-1">Receiving Party</legend>
        <div className="space-y-2">
          <Label htmlFor="receiving_party_name">Name</Label>
          <Input id="receiving_party_name" name="receiving_party_name" value={formData.receiving_party_name} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., Other Party's Company Name / Full Name" aria-describedby="receiving_party_name_error" />
          {formErrors.receiving_party_name && <p id="receiving_party_name_error" className="text-sm text-red-600 mt-1">{formErrors.receiving_party_name.join(', ')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="receiving_party_address">Address</Label>
          <Input id="receiving_party_address" name="receiving_party_address" value={formData.receiving_party_address} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., 456 Oak Ave, Otherville, USA" aria-describedby="receiving_party_address_error" />
          {formErrors.receiving_party_address && <p id="receiving_party_address_error" className="text-sm text-red-600 mt-1">{formErrors.receiving_party_address.join(', ')}</p>}
        </div>
      </fieldset>

      {/* Agreement Details */}
      <fieldset className="space-y-3 border p-4 rounded-md">
        <legend className="text-lg font-medium px-1">Agreement Details</legend>
        <div className="space-y-2">
          <Label htmlFor="effective_date">Effective Date</Label>
          <Input id="effective_date" name="effective_date" type="date" value={formData.effective_date} onChange={handleChange} disabled={isSubmitting} aria-describedby="effective_date_error" />
          {formErrors.effective_date && <p id="effective_date_error" className="text-sm text-red-600 mt-1">{formErrors.effective_date.join(', ')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="purpose_of_nda">Purpose of NDA</Label>
          <Textarea id="purpose_of_nda" name="purpose_of_nda" value={formData.purpose_of_nda} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., To discuss potential business collaboration, evaluate software..." aria-describedby="purpose_of_nda_error" />
          {formErrors.purpose_of_nda && <p id="purpose_of_nda_error" className="text-sm text-red-600 mt-1">{formErrors.purpose_of_nda.join(', ')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="definition_of_confidential_information">Definition of Confidential Information</Label>
          <Textarea id="definition_of_confidential_information" name="definition_of_confidential_information" value={formData.definition_of_confidential_information} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., Any and all technical, business, financial information..." aria-describedby="definition_of_confidential_information_error" />
          {formErrors.definition_of_confidential_information && <p id="definition_of_confidential_information_error" className="text-sm text-red-600 mt-1">{formErrors.definition_of_confidential_information.join(', ')}</p>}
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
