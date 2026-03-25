import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase-server';
import { fetchNotionMembers } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const notionMembers = await fetchNotionMembers();
    const supabase = getSupabaseClient();

    const rows = notionMembers.map(m => ({
      notion_id: m.notionId,
      name: m.name,
      email: m.email || null,
      birthday: m.birthday || null,
      hire_date: m.hireDate || null,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('members')
      .upsert(rows, { onConflict: 'notion_id' });

    if (error) throw error;

    return NextResponse.json({ ok: true, synced: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
