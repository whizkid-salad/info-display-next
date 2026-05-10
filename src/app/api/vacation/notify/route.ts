import { NextRequest, NextResponse } from 'next/server';
import { fetchVacations, fetchVacationsRaw, fetchTypeMapDebug, VacationEntry } from '@/lib/notion-vacation';
import { getSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const NAME_COLOR = '#1a73e8';
const HALF_ICON = '⏰';

function kstNow(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHeader(d: Date): string {
  const yy = String(d.getUTCFullYear()).slice(2);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${yy}년 ${m}월 ${day}일(${DOW[d.getUTCDay()]})`;
}

function isHalfDay(type: string): boolean {
  return type.includes('반차');
}

// 풀=1.0, 반=0.5, 반반=0.25
function vacationWeight(type: string): number {
  if (type.includes('반반차')) return 0.25;
  if (type.includes('반차')) return 0.5;
  return 1.0;
}

function dateFromYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

async function fetchMemberCount(): Promise<number | null> {
  try {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true });
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

function buildTodayBody(
  todays: VacationEntry[],
  datesByName: Map<string, Set<string>>
) {
  const seen = new Set<string>();
  const linesPlain: string[] = [];
  const linesHtml: string[] = [];
  for (const e of todays) {
    const key = `${e.name}|${e.type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const allDates = Array.from(datesByName.get(e.name) || []).sort();
    let suffix = '';
    if (allDates.length > 1) {
      const days = allDates.map(d => Number(d.slice(8, 10))).join(',');
      suffix = `(${days})`;
    }
    const half = isHalfDay(e.type);
    const prefix = half ? `${HALF_ICON} ` : '';
    linesPlain.push(`${prefix}${e.name} - ${e.type}${suffix}`);
    linesHtml.push(`${prefix}<b><font color="${NAME_COLOR}">${e.name}</font></b> - ${e.type}${suffix}`);
  }
  return {
    plain: linesPlain.length > 0 ? linesPlain.join(' / ') : '오늘 휴가자 없음',
    html: linesHtml.length > 0 ? linesHtml.join(' / ') : '오늘 휴가자 없음',
    count: linesPlain.length,
  };
}

// 주간 섹션: bold/color 없이 plain text. 일자별로 widget 분리.
function buildWeekBody(entries: VacationEntry[], weekStart: Date, weekEnd: Date) {
  const startStr = ymd(weekStart);
  const endStr = ymd(weekEnd);

  const byDate = new Map<string, VacationEntry[]>();
  for (const e of entries) {
    if (e.date < startStr || e.date > endStr) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  const dailyLines: string[] = [];
  for (const d of sortedDates) {
    const date = dateFromYmd(d);
    const m = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dowChar = DOW[date.getUTCDay()];
    const dateLabel = `${m}/${day}(${dowChar})`;

    const seen = new Set<string>();
    const parts: string[] = [];
    for (const it of byDate.get(d)!) {
      const k = `${it.name}|${it.type}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const half = isHalfDay(it.type);
      const halfPrefix = half ? `${HALF_ICON} ` : '';
      const annot = half ? `(${it.type})` : '';
      parts.push(`${halfPrefix}${it.name}${annot}`);
    }
    dailyLines.push(`${dateLabel}  ${parts.join(', ')}`);
  }

  return {
    plain: dailyLines.join('\n'),
    dailyLines,
    count: dailyLines.length,
  };
}

function getWeekContext(today: Date): { title: string; start: Date; end: Date } | null {
  const dow = today.getUTCDay();
  if (dow === 1) {
    const start = new Date(today);
    const end = new Date(today);
    end.setUTCDate(today.getUTCDate() + 4);
    return { title: '이번주 휴가자', start, end };
  }
  if (dow === 5) {
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() + 3);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
    return { title: '다음주 휴가자', start, end };
  }
  return null;
}

function buildUtilizationLine(todays: VacationEntry[], memberCount: number): string {
  const weightByName = new Map<string, number>();
  for (const e of todays) {
    const w = vacationWeight(e.type);
    weightByName.set(e.name, Math.max(weightByName.get(e.name) || 0, w));
  }
  let absentSum = 0;
  weightByName.forEach(w => { absentSum += w; });
  const absent = Math.round(absentSum);
  const present = memberCount - absent;
  const rate = Math.round((present / memberCount) * 100);
  return `샐러드랩 가동률 : ${present}/${memberCount} ${rate}%`;
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';
    const dry = url.searchParams.get('dry') === '1';
    const debug = url.searchParams.get('debug') === '1';
    const dateOverride = url.searchParams.get('date');

    const today = dateOverride ? dateFromYmd(dateOverride) : kstNow();
    const dow = today.getUTCDay();
    if (!force && (dow === 0 || dow === 6)) {
      return NextResponse.json({ ok: true, skipped: 'weekend' });
    }

    const todayStr = ymd(today);
    const end = new Date(today);
    end.setUTCDate(today.getUTCDate() + 14);
    const endStr = ymd(end);

    if (debug) {
      const [raw, typeMap, entries, memberCount] = await Promise.all([
        fetchVacationsRaw(todayStr, endStr),
        fetchTypeMapDebug(),
        fetchVacations(todayStr, endStr),
        fetchMemberCount(),
      ]);
      const sample = raw.slice(0, 3).map(p => ({
        propertyKeys: Object.keys(p.properties || {}),
        properties: p.properties,
      }));
      return NextResponse.json({
        ok: true,
        debug: true,
        range: { from: todayStr, to: endStr },
        rawPageCount: raw.length,
        parsedEntryCount: entries.length,
        memberCount,
        typeMap,
        entries,
        sample,
      });
    }

    const [entries, memberCount] = await Promise.all([
      fetchVacations(todayStr, endStr),
      fetchMemberCount(),
    ]);
    const todays = entries.filter(e => e.date === todayStr);

    const datesByName = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!datesByName.has(e.name)) datesByName.set(e.name, new Set());
      datesByName.get(e.name)!.add(e.date);
    }

    const todayBody = buildTodayBody(todays, datesByName);
    const weekCtx = getWeekContext(today);
    const weekBody = weekCtx ? buildWeekBody(entries, weekCtx.start, weekCtx.end) : null;

    const utilLine = memberCount && memberCount > 0 ? buildUtilizationLine(todays, memberCount) : null;

    const todayHtml = utilLine ? `${todayBody.html}<br><br>${utilLine}` : todayBody.html;
    const todayPlain = utilLine ? `${todayBody.plain}\n\n${utilLine}` : todayBody.plain;

    const headerTitle = `오늘의 휴가자 · ${formatHeader(today)}`;
    const message = weekBody
      ? `*${headerTitle}*\n${todayPlain}\n\n*${weekCtx!.title}*\n${weekBody.plain}`
      : `*${headerTitle}*\n${todayPlain}`;

    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        message,
        count: todayBody.count,
        weekTitle: weekCtx?.title || null,
        weekRange: weekCtx ? { from: ymd(weekCtx.start), to: ymd(weekCtx.end) } : null,
        weekDailyLines: weekBody?.dailyLines || null,
        utilLine,
        memberCount,
        todayHtml,
        build: buildSha,
      });
    }

    const webhookUrl = process.env.GOOGLE_CHAT_VACATION_WEBHOOK;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'GOOGLE_CHAT_VACATION_WEBHOOK not set', message }, { status: 500 });
    }

    const sections: any[] = [
      { widgets: [{ textParagraph: { text: todayHtml } }] },
    ];
    if (weekBody && weekCtx && weekBody.dailyLines.length > 0) {
      sections.push({
        header: weekCtx.title,
        collapsible: true,
        uncollapsibleWidgetsCount: 5,
        widgets: weekBody.dailyLines.map(line => ({ textParagraph: { text: line } })),
      });
    }

    const payload = {
      cardsV2: [
        {
          cardId: `vacation-${todayStr}`,
          card: {
            header: { title: headerTitle },
            sections,
          },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const details = await res.text();
      return NextResponse.json({ error: 'Google Chat webhook failed', details }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: todayBody.count, message, build: buildSha });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
