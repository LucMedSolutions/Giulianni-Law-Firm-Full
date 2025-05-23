import Image from "next/image"
import LoginButtons from "@/components/login-buttons"
import HelpModal from "@/components/help-modal"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 bg-white">
      <div className="w-full max-w-md flex flex-col items-center justify-center min-h-screen">
        <div className="mb-12 text-center">
          <Image src="/logo.png" alt="The Giuliani Law Firm" width={300} height={100} priority className="mx-auto" />
        </div>

        <LoginButtons />

        <div className="mt-auto pt-8 flex flex-col items-center space-y-2">
          <HelpModal />
        </div>
      </div>
    </main>
  )
}
