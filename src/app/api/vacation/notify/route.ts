import { NextRequest, NextResponse } from 'next/server';
import { fetchVacations, fetchVacationsRaw, fetchTypeMapDebug, VacationEntry } from '@/lib/notion-vacation';

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

function dateFromYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function buildTodayBody(
  todays: VacationEntry[],
  datesByName: Map<string, Set<string>>,
  todayStr: string
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
  const linesPlain: string[] = [];
  const linesHtml: string[] = [];

  for (const d of sortedDates) {
    const date = dateFromYmd(d);
    const m = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dowChar = DOW[date.getUTCDay()];
    const dateLabel = `${m}/${day}(${dowChar})`;

    const seen = new Set<string>();
    const partsPlain: string[] = [];
    const partsHtml: string[] = [];
    for (const it of byDate.get(d)!) {
      const k = `${it.name}|${it.type}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const half = isHalfDay(it.type);
      const halfPrefix = half ? `${HALF_ICON} ` : '';
      const annot = half ? `(${it.type})` : '';
      partsPlain.push(`${halfPrefix}${it.name}${annot}`);
      partsHtml.push(`${halfPrefix}<b><font color="${NAME_COLOR}">${it.name}</font></b>${annot}`);
    }

    linesPlain.push(`${dateLabel}  ${partsPlain.join(', ')}`);
    linesHtml.push(`<b>${dateLabel}</b>  ${partsHtml.join(', ')}`);
  }

  return {
    plain: linesPlain.join('\n'),
    html: linesHtml.join('<br>'),
    count: sortedDates.length,
  };
}

// 주간 섹션 결정: 월요일=이번주, 금요일=다음주
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
      const [raw, typeMap, entries] = await Promise.all([
        fetchVacationsRaw(todayStr, endStr),
        fetchTypeMapDebug(),
        fetchVacations(todayStr, endStr),
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
        typeMap,
        entries,
        sample,
      });
    }

    const entries = await fetchVacations(todayStr, endStr);
    const todays = entries.filter(e => e.date === todayStr);

    const datesByName = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!datesByName.has(e.name)) datesByName.set(e.name, new Set());
      datesByName.get(e.name)!.add(e.date);
    }

    const todayBody = buildTodayBody(todays, datesByName, todayStr);
    const weekCtx = getWeekContext(today);
    const weekBody = weekCtx ? buildWeekBody(entries, weekCtx.start, weekCtx.end) : null;

    const headerTitle = `오늘의 휴가자 · ${formatHeader(today)}`;
    const message = weekBody
      ? `*${headerTitle}*\n${todayBody.plain}\n\n*${weekCtx!.title}*\n${weekBody.plain}`
      : `*${headerTitle}*\n${todayBody.plain}`;

    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        message,
        count: todayBody.count,
        weekTitle: weekCtx?.title || null,
        weekRange: weekCtx ? { from: ymd(weekCtx.start), to: ymd(weekCtx.end) } : null,
        weekHtml: weekBody?.html || null,
        todayHtml: todayBody.html,
        build: buildSha,
      });
    }

    const webhookUrl = process.env.GOOGLE_CHAT_VACATION_WEBHOOK;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'GOOGLE_CHAT_VACATION_WEBHOOK not set', message }, { status: 500 });
    }

    const sections: any[] = [
      { widgets: [{ textParagraph: { text: todayBody.html } }] },
    ];
    if (weekBody && weekCtx) {
      sections.push({
        header: weekCtx.title,
        widgets: [{ textParagraph: { text: weekBody.html } }],
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
