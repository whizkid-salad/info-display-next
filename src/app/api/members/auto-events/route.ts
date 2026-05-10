import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { fetchNotionMembers } from '@/lib/notion';

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

// Vercel Cron은 GET 요청을 보내므로 GET도 동일하게 처리
export async function GET(request: NextRequest) {
  return POST(request);
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

    // 1) 노션 → Supabase 멤버 동기화 (노션에서 제거된 멤버는 삭제)
    let syncedCount = 0;
    let deletedCount = 0;
    try {
      const notionMembers = await fetchNotionMembers();
      const rows = notionMembers.map(m => ({
        notion_id: m.notionId,
        name: m.name,
        email: m.email || null,
        birthday: m.birthday || null,
        hire_date: m.hireDate || null,
        synced_at: new Date().toISOString(),
      }));
      await supabase.from('members').upsert(rows, { onConflict: 'notion_id' });
      syncedCount = rows.length;

      if (rows.length > 0) {
        const notionIds = new Set(rows.map(r => r.notion_id));
        const { data: existing } = await supabase.from('members').select('notion_id');
        const toDelete = (existing || [])
          .map(e => e.notion_id)
          .filter(id => !notionIds.has(id));
        if (toDelete.length > 0) {
          const { data: deleted, error: delErr } = await supabase
            .from('members')
            .delete()
            .in('notion_id', toDelete)
            .select('notion_id');
          if (delErr) {
            console.error('멤버 삭제 실패:', delErr);
          } else {
            deletedCount = deleted?.length || 0;
            console.log(`멤버 삭제: 후보 ${toDelete.length}건 → 실제 삭제 ${deletedCount}건`);
          }
        }
      }
    } catch (e) {
      console.error('Notion sync error (계속 진행):', e);
    }

    // 2) 다음 주 범위의 기존 이벤트 조회 (중복 방지용)
    const rangeStart = nextMonday.toISOString();
    const rangeEnd = new Date(nextSunday.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: existingEvents } = await supabase
      .from('dashboard_events')
      .select('title, start_time')
      .gte('start_time', rangeStart)
      .lt('start_time', rangeEnd);

    // "제목|YYYY-MM-DD" 형태로 Set 구성
    const existingKeys = new Set(
      (existingEvents || []).map(e => `${e.title}|${e.start_time.slice(0, 10)}`)
    );

    // 3) 멤버 목록
    const { data: members, error: membersError } = await supabase.from('members').select('*');
    if (membersError) throw membersError;

    const createdEvents: string[] = [];
    const skippedEvents: string[] = [];

    for (const member of members || []) {
      // 생일 체크
      if (member.birthday) {
        const eventDate = anniversaryInRange(member.birthday, nextMonday, nextSunday);
        if (eventDate) {
          const birthYear = new Date(member.birthday).getUTCFullYear();
          const age = eventDate.getUTCFullYear() - birthYear;
          const startTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T08:00:00+09:00`;
          const endTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T20:00:00+09:00`;

          const birthdayTitle = `🎂 ${member.name} 님의 생일입니다`;
          const dateKey = startTime.slice(0, 10);
          if (existingKeys.has(`${birthdayTitle}|${dateKey}`)) {
            skippedEvents.push(`birthday:${member.name}(dup)`);
          } else {
            await supabase.from('dashboard_events').insert({
              title: birthdayTitle,
              template: 'birthday',
              subtitle: `Happy Birthday! 🎉`,
              start_time: startTime,
              end_time: endTime,
              floors: ['6', '8'],
            });
            createdEvents.push(`birthday:${member.name}`);
          }
        }
      }

      // 입사일 체크
      if (member.hire_date) {
        const eventDate = anniversaryInRange(member.hire_date, nextMonday, nextSunday);
        if (eventDate) {
          const hireYear = new Date(member.hire_date).getUTCFullYear();
          const years = eventDate.getUTCFullYear() - hireYear;
          const startTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T08:00:00+09:00`;
          const endTime = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth()+1).padStart(2,'0')}-${String(eventDate.getUTCDate()).padStart(2,'0')}T20:00:00+09:00`;

          const hireTitle = years === 0 ? `🎉 ${member.name} 님의 입사를 환영합니다!` : `🎉 ${member.name} 님의 ${years}주년 입사일입니다`;
          const hireDateKey = startTime.slice(0, 10);
          if (existingKeys.has(`${hireTitle}|${hireDateKey}`)) {
            skippedEvents.push(`hire:${member.name}:${years}yr(dup)`);
          } else {
            await supabase.from('dashboard_events').insert({
              title: hireTitle,
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
    }

    return NextResponse.json({ ok: true, synced: syncedCount, deleted: deletedCount, created: createdEvents, skipped: skippedEvents, range: { from: nextMonday.toISOString().slice(0,10), to: nextSunday.toISOString().slice(0,10) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
