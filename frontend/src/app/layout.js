// /frontend/src/app/layout.js
export const metadata = {
  title: 'Giulianni Law Firm',
  description: 'Automation System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
