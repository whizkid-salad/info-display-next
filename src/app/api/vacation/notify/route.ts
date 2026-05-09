import { NextRequest, NextResponse } from 'next/server';
import { fetchVacations, fetchVacationsRaw, fetchTypeMapDebug } from '@/lib/notion-vacation';

export const dynamic = 'force-dynamic';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

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
  return `${yy}년${m}월${day}일(${DOW[d.getUTCDay()]})`;
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

    const today = kstNow();
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

    const NAME_COLOR = '#1a73e8';
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
      linesPlain.push(`${e.name} - ${e.type}${suffix}`);
      linesHtml.push(`<b><font color="${NAME_COLOR}">${e.name}</font></b> - ${e.type}${suffix}`);
    }

    const headerTitle = `오늘의 휴가자 ${formatHeader(today)}`;
    const bodyPlain = linesPlain.length > 0 ? linesPlain.join(' / ') : '오늘 휴가자 없음';
    const bodyHtml = linesHtml.length > 0 ? linesHtml.join(' / ') : '오늘 휴가자 없음';
    const message = `*${headerTitle}*\n${bodyPlain}`;

    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

    if (dry) {
      return NextResponse.json({ ok: true, dry: true, message, count: linesPlain.length, build: buildSha, html: bodyHtml });
    }

    const webhookUrl = process.env.GOOGLE_CHAT_VACATION_WEBHOOK;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'GOOGLE_CHAT_VACATION_WEBHOOK not set', message },
        { status: 500 }
      );
    }

    const payload = {
      cardsV2: [
        {
          cardId: `vacation-${todayStr}`,
          card: {
            header: { title: headerTitle },
            sections: [
              {
                widgets: [{ textParagraph: { text: bodyHtml } }],
              },
            ],
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

    return NextResponse.json({ ok: true, count: linesPlain.length, message, build: buildSha });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
