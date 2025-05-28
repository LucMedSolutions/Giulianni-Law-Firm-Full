// /frontend/src/app/page.js
import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Giulianni Law Firm Automation</h1>
      <p>This is the homepage.</p>
      <Link href="/login">Go to Login</Link>
    </div>
  );
}
