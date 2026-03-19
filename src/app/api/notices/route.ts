import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const floor = searchParams.get('floor');

  const supabase = getSupabaseClient();
  let query = supabase.from('quick_notices').select('*').order('created_at', { ascending: false });
  if (floor) query = query.eq('floor', floor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notices: data });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from('quick_notices').insert({
    floor: body.floor,
    title: body.title,
    subtitle: body.subtitle || '',
    template: body.template || 'notice',
    priority: body.priority || 0,
    is_active: true,
    created_by: session.user?.email || null,
    expires_at: body.expires_at || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notice: data }, { status: 201 });
}
