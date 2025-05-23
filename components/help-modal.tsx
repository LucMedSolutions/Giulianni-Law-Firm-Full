"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function HelpModal() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-gray-600 hover:text-gray-900 text-sm font-medium">
        Need Help? Click here for more information
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
            <DialogDescription>Get assistance with logging into The Giuliani Law Firm portal.</DialogDescription>
            <Button
              variant="ghost"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogHeader>

          <div className="space-y-4">
            <h3 className="font-medium text-lg">Login Instructions</h3>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>For Staff Members:</strong> Use your firm email address and password provided by the IT
                department.
              </p>
              <p className="text-sm">
                <strong>For Clients:</strong> Use the email address you provided to the firm and the password you
                created or the magic link option.
              </p>
            </div>

            <h3 className="font-medium text-lg">Common Issues</h3>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Forgot Password:</strong> Use the "Login with Magic Link" option to receive a login link via
                email.
              </p>
              <p className="text-sm">
                <strong>Account Locked:</strong> After multiple failed attempts, your account may be temporarily locked.
                Please wait 30 minutes and try again.
              </p>
              <p className="text-sm">
                <strong>Technical Difficulties:</strong> If you're experiencing persistent issues, please contact our
                support team.
              </p>
            </div>

            <h3 className="font-medium text-lg">Contact Support</h3>
            <p className="text-sm">
              Email: support@giulianilawfirm.com
              <br />
              Phone: (555) 123-4567
              <br />
              Hours: Monday-Friday, 9:00 AM - 5:00 PM EST
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
