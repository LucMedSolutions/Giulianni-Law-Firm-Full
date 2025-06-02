'use client';

import React, { useState, useEffect } from 'react';
import { z, ZodError } from 'zod'; // Import Zod
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { GeneralConsultationFormValues, PreferredContactMethod } from '@/types/forms'; // Import the interfaces

// GeneralConsultationFormValues is now imported

export const initialGeneralConsultationFormData: GeneralConsultationFormValues = {
  client_full_name: '',
  client_email: '',
  client_phone: '',
  type_of_legal_issue: '',
  brief_description_of_issue: '',
  preferred_contact_method: '',
};

interface GeneralConsultationFormProps {
  caseId: string; // To associate the intake with a case
  onSubmitSuccess?: (formType: string) => void;
}

// Zod Schema for client-side validation (mirrors server-side where applicable)
const GeneralConsultationClientSchema = z.object({
  client_full_name: z.string().min(1, "Full name is required."),
  client_email: z.string().email("Invalid email address."),
  client_phone: z.string().optional().or(z.literal('')), // Allow empty string or valid phone format if provided
  type_of_legal_issue: z.string().min(1, "Type of legal issue is required."),
  brief_description_of_issue: z.string().min(10, "Description must be at least 10 characters."),
  preferred_contact_method: z.enum(['email', 'phone'], { message: "Preferred contact method must be 'email' or 'phone'." }),
});

// Type for individual field errors
type FormErrors = {
  [K in keyof GeneralConsultationFormValues]?: string[];
};


export default function GeneralConsultationForm({ caseId, onSubmitSuccess }: GeneralConsultationFormProps) {
  const [formData, setFormData] = useState<GeneralConsultationFormValues>(initialGeneralConsultationFormData);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Clear errors for a field when it's changed
  useEffect(() => {
    if (Object.keys(formErrors).length > 0) {
        // This is a simple way to clear all errors on any change.
        // A more sophisticated approach might clear errors field by field.
        // For this example, let's clear specific errors as user types.
    }
  }, [formData, formErrors]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof GeneralConsultationFormValues, value: string) => {
    if (name === "preferred_contact_method") {
      setFormData(prev => ({ ...prev, [name]: value as PreferredContactMethod | '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({}); // Clear previous form errors
    setSubmitStatus(null); // Clear previous submission status

    // Client-side validation
    const validationResult = GeneralConsultationClientSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: FormErrors = {};
      validationResult.error.errors.forEach(err => {
        const path = err.path[0] as keyof GeneralConsultationFormValues;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path]?.push(err.message);
      });
      setFormErrors(fieldErrors);
      setSubmitStatus({ type: 'error', message: 'Please correct the errors in the form.' });
      setIsSubmitting(false); // Ensure isSubmitting is false if validation fails early
      return;
    }

    setIsSubmitting(true); // Set submitting state only after validation passes

    if (!caseId) {
        setSubmitStatus({type: 'error', message: 'Error: Case ID is missing. Cannot submit form.'});
        setIsSubmitting(false);
        return;
    }
    // The check for preferred_contact_method is now handled by Zod schema

    const payload = {
      case_id: caseId, // Already validated by parent component
      form_type: 'general_consultation' as const,
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
        setSubmitStatus({ type: 'success', message: responseData.message || 'Consultation form submitted successfully!' });
        setFormData(initialGeneralConsultationFormData); // Reset form
        if (onSubmitSuccess) {
          onSubmitSuccess('General Consultation');
        }
      } else {
        if (responseData.details && typeof responseData.details === 'object' && !Array.isArray(responseData.details)) {
            // Server-side Zod errors
            const serverFieldErrors: FormErrors = {};
            let generalErrorMessage = 'Submission failed due to validation errors: ';
            const errorDetails: string[] = [];

            Object.entries(responseData.details).forEach(([field, errors]) => {
                const key = field as keyof GeneralConsultationFormValues;
                serverFieldErrors[key] = (errors as string[]);
                errorDetails.push(`${field}: ${(errors as string[]).join(', ')}`);
            });
            setFormErrors(prevErrors => ({...prevErrors, ...serverFieldErrors})); // Merge with any client errors
            setSubmitStatus({ type: 'error', message: generalErrorMessage + errorDetails.join('; ') });

        } else {
            // Other server errors
            setSubmitStatus({ type: 'error', message: responseData.error || responseData.details || 'Failed to submit consultation form.' });
        }
      }
    } catch (error: any) {
      console.error("Error submitting consultation form:", error);
      // Check if it's a ZodError from client-side if not caught by safeParse somehow (shouldn't happen with this logic)
      if (error instanceof ZodError) {
        const fieldErrors: FormErrors = {};
        error.errors.forEach(err => {
            const path = err.path[0] as keyof GeneralConsultationFormValues;
            if (!fieldErrors[path]) {
            fieldErrors[path] = [];
            }
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
        <div className="space-y-2">
            <Label htmlFor="client_full_name">Full Name</Label>
            <Input id="client_full_name" name="client_full_name" value={formData.client_full_name} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., John Doe" aria-describedby="client_full_name_error" />
            {formErrors.client_full_name && <p id="client_full_name_error" className="text-sm text-red-600 mt-1">{formErrors.client_full_name.join(', ')}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="client_email">Email Address</Label>
            <Input id="client_email" name="client_email" type="email" value={formData.client_email} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., john.doe@example.com" aria-describedby="client_email_error" />
            {formErrors.client_email && <p id="client_email_error" className="text-sm text-red-600 mt-1">{formErrors.client_email.join(', ')}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="client_phone">Phone Number (Optional)</Label>
            <Input id="client_phone" name="client_phone" type="tel" value={formData.client_phone} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., (555) 123-4567" aria-describedby="client_phone_error" />
            {formErrors.client_phone && <p id="client_phone_error" className="text-sm text-red-600 mt-1">{formErrors.client_phone.join(', ')}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="type_of_legal_issue">Type of Legal Issue</Label>
            <Input id="type_of_legal_issue" name="type_of_legal_issue" value={formData.type_of_legal_issue} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., Contract Dispute, Business Formation, Real Estate" aria-describedby="type_of_legal_issue_error" />
            {formErrors.type_of_legal_issue && <p id="type_of_legal_issue_error" className="text-sm text-red-600 mt-1">{formErrors.type_of_legal_issue.join(', ')}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="brief_description_of_issue">Brief Description of Legal Issue</Label>
            <Textarea id="brief_description_of_issue" name="brief_description_of_issue" value={formData.brief_description_of_issue} onChange={handleChange} disabled={isSubmitting} rows={5} placeholder="Please provide a summary of your legal concern." aria-describedby="brief_description_of_issue_error" />
            {formErrors.brief_description_of_issue && <p id="brief_description_of_issue_error" className="text-sm text-red-600 mt-1">{formErrors.brief_description_of_issue.join(', ')}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
            <Select name="preferred_contact_method" value={formData.preferred_contact_method} onValueChange={(value) => handleSelectChange('preferred_contact_method', value)} disabled={isSubmitting} >
                <SelectTrigger id="preferred_contact_method" aria-describedby="preferred_contact_method_error">
                    <SelectValue placeholder="Select a method..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
            </Select>
            {formErrors.preferred_contact_method && <p id="preferred_contact_method_error" className="text-sm text-red-600 mt-1">{formErrors.preferred_contact_method.join(', ')}</p>}
        </div>

        {submitStatus && (
            <Alert variant={submitStatus.type === 'success' ? 'default' : 'destructive'} className={`mt-4 ${submitStatus.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700' : ''}`}>
            {submitStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{submitStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{submitStatus.message}</AlertDescription>
            </Alert>
        )}
        
        <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
            {isSubmitting ? 'Submitting...' : 'Submit Consultation Request'}
        </Button>
    </form>
  );
}
