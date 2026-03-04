import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    if (!token) {
      console.error('[Recommend API] No auth token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/recommend/projects`;
    console.log('[Recommend API] Calling:', backendUrl);

    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include',
    });

    console.log('[Recommend API] Response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Recommend API] Backend error:', errorText);
      throw new Error(`Backend returned ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    console.log('[Recommend API] Success:', data);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Recommend API] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
