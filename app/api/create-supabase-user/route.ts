import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log("TEST LOG: /api/create-supabase-user POST route was HIT!");
  console.log("TEST LOG: Request method:", request.method);

  try {
    const body = await request.json();
    console.log("TEST LOG: Request body parsed:", body);
  } catch (e: any) {
    console.log("TEST LOG: Error parsing request body:", e.message);
  }

  return NextResponse.json({ message: "Test response from /api/create-supabase-user. Check Vercel logs for 'TEST LOG'." }, { status: 200 });
}
