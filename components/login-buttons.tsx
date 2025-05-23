"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import LoginModal from "@/components/login-modal"
import ClientRegistrationModal from "@/components/client-registration-modal"

export default function LoginButtons() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [userType, setUserType] = useState<"staff" | "client" | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleLoginClick = (type: "staff" | "client") => {
    setUserType(type)
    setIsLoginModalOpen(true)
  }

  const handleRegisterClick = () => {
    setIsRegistrationModalOpen(true)
  }

  return (
    <div className="w-full space-y-4">
      <Button
        className="w-full h-14 bg-[#4a4a5e] hover:bg-[#3a3a4a] text-white font-medium text-lg"
        onClick={() => handleLoginClick("staff")}
      >
        LOGIN AS A STAFF MEMBER
      </Button>

      <Button
        className="w-full h-14 bg-[#4a4a5e] hover:bg-[#3a3a4a] text-white font-medium text-lg"
        onClick={() => handleLoginClick("client")}
      >
        LOGIN AS A CLIENT
      </Button>

      <div className="text-center">
        <button onClick={handleRegisterClick} className="text-sm text-gray-600 hover:text-gray-900 underline mt-2">
          Register as a client
        </button>
      </div>

      {isLoginModalOpen && (
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} userType={userType} />
      )}

      {isRegistrationModalOpen && (
        <ClientRegistrationModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} />
      )}
    </div>
  )
}
