import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// 날짜가 특정 범위 내에 있는지 (월/일 기준)
function anniversaryInRange(dateStr: string, rangeStart: Date, rangeEnd: Date): Date | null {
  const d = new Date(dateStr);
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  // rangeStart ~ rangeEnd 사이 각 날짜 확인
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    if (cursor.getUTCMonth() === month && cursor.getUTCDate() === day) {
      return new Date(cursor);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 다음 주 월요일 ~ 일요일 (KST 기준, UTC+9)
    const now = new Date();
    // 현재 KST 날짜
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    // 다음 주 월요일 (KST)
    const dayOfWeek = kstNow.getUTCDay(); // 0=일, 1=월, ..., 6=토
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(kstNow);
    nextMonday.setUTCDate(kstNow.getUTCDate() + daysUntilNextMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);
    const nextSunday = new Date(nextMonday);
    nextSunday.setUTCDate(nextMonday.getUTCDate() + 6);

    // 멤버 목록
    const { data: members, error: membersError } = await supabase.from('members').select('*');
    if (membersError) throw membersError;

    const createdEvents: string[] = [];

    for (const member of members || []) {
      // 생일 체크
      if (member.birthday) {
        const eventDate = anniversaryInRange(member.birthday, nextMonday, nextSunday);
        if (eventDate) {
          const birthYear = new Date(member.birthday).getUTCFullYear();
          const age = eventDate.getUTCFullYear() - birthYear;
          const startTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T09:00:00+09:00`;
          const endTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T18:00:00+09:00`;

          await supabase.from('dashboard_events').insert({
            title: `🎂 ${member.name} 님의 생일입니다`,
            template: 'birthday',
            subtitle: `Happy Birthday! 🎉`,
            start_time: startTime,
            end_time: endTime,
            floors: ['6', '8'],
          });
          createdEvents.push(`birthday:${member.name}`);
        }
      }

      // 입사일 체크
      if (member.hire_date) {
        const eventDate = anniversaryInRange(member.hire_date, nextMonday, nextSunday);
        if (eventDate) {
          const hireYear = new Date(member.hire_date).getUTCFullYear();
          const years = eventDate.getUTCFullYear() - hireYear;
          const startTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T09:00:00+09:00`;
          const endTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T18:00:00+09:00`;

          await supabase.from('dashboard_events').insert({
            title: years === 0 ? `🎉 ${member.name} 님의 입사를 환영합니다!` : `🎉 ${member.name} 님의 ${years}주년 입사일입니다`,
            template: 'celebration',
            subtitle: years === 0 ? `입사를 축하합니다!` : `입사 ${years}주년을 축하합니다!`,
            start_time: startTime,
            end_time: endTime,
            floors: ['6', '8'],
          });
          createdEvents.push(`hire:${member.name}:${years}yr`);
        }
      }
    }

    return NextResponse.json({ ok: true, created: createdEvents, range: { from: nextMonday.toISOString().slice(0,10), to: nextSunday.toISOString().slice(0,10) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
