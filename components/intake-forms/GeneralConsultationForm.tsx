'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface GeneralConsultationFormValues {
  client_full_name: string;
  client_email: string;
  client_phone?: string;
  type_of_legal_issue: string;
  brief_description_of_issue: string;
  preferred_contact_method: 'email' | 'phone' | '';
}

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

export default function GeneralConsultationForm({ caseId, onSubmitSuccess }: GeneralConsultationFormProps) {
  const [formData, setFormData] = useState<GeneralConsultationFormValues>(initialGeneralConsultationFormData);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
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
    if (!formData.preferred_contact_method) {
        setSubmitStatus({type: 'error', message: 'Please select a preferred contact method.'});
        setIsSubmitting(false);
        return;
    }

    const payload = {
      case_id: caseId,
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
            const errorMessages = Object.entries(responseData.details)
                .map(([field, errors]: [string, any]) => `${field}: ${(errors as string[]).join(', ')}`)
                .join('; ');
            setSubmitStatus({ type: 'error', message: `Validation failed: ${errorMessages}` });
        } else {
            setSubmitStatus({ type: 'error', message: responseData.error || responseData.details || 'Failed to submit consultation form.' });
        }
      }
    } catch (error: any) {
      console.error("Error submitting consultation form:", error);
      setSubmitStatus({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="client_full_name">Full Name</Label>
            <Input id="client_full_name" name="client_full_name" value={formData.client_full_name} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., John Doe" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="client_email">Email Address</Label>
            <Input id="client_email" name="client_email" type="email" value={formData.client_email} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., john.doe@example.com" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="client_phone">Phone Number (Optional)</Label>
            <Input id="client_phone" name="client_phone" type="tel" value={formData.client_phone} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., (555) 123-4567" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="type_of_legal_issue">Type of Legal Issue</Label>
            <Input id="type_of_legal_issue" name="type_of_legal_issue" value={formData.type_of_legal_issue} onChange={handleChange} required disabled={isSubmitting} placeholder="e.g., Contract Dispute, Business Formation, Real Estate" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="brief_description_of_issue">Brief Description of Legal Issue</Label>
            <Textarea id="brief_description_of_issue" name="brief_description_of_issue" value={formData.brief_description_of_issue} onChange={handleChange} required disabled={isSubmitting} rows={5} placeholder="Please provide a summary of your legal concern." />
        </div>
        <div className="space-y-2">
            <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
            <Select name="preferred_contact_method" value={formData.preferred_contact_method} onValueChange={(value) => handleSelectChange('preferred_contact_method', value)} required disabled={isSubmitting}>
                <SelectTrigger id="preferred_contact_method">
                    <SelectValue placeholder="Select a method..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
            </Select>
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
