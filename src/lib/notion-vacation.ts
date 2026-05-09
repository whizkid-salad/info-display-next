const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface VacationEntry {
  name: string;
  date: string; // YYYY-MM-DD
  type: string; // 연차, 오전반차, 오후반차, 오전반반차, 오후반반차, 예비군, 생일반차, ...
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

function extractTitle(props: any): string {
  for (const key of Object.keys(props)) {
    if (props[key]?.type === 'title') {
      return props[key].title?.[0]?.plain_text?.trim() || '';
    }
  }
  return '';
}

function extractTypeName(prop: any): string {
  if (!prop) return '';
  if (prop.type === 'status') return prop.status?.name || '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'multi_select') return prop.multi_select?.[0]?.name || '';
  if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text || '';
  if (prop.type === 'formula') {
    const f = prop.formula;
    if (f?.type === 'string') return f.string || '';
  }
  if (prop.type === 'rollup') {
    const r = prop.rollup;
    if (r?.type === 'array' && Array.isArray(r.array) && r.array.length > 0) {
      return extractTypeName(r.array[0]);
    }
  }
  return '';
}

export async function fetchVacationsRaw(startDate: string, endDate: string): Promise<any[]> {
  const dbId = process.env.NOTION_VACATION_DB_ID;
  if (!dbId) throw new Error('NOTION_VACATION_DB_ID not set');

  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = {
      page_size: 100,
      filter: {
        and: [
          { property: '날짜', date: { on_or_after: startDate } },
          { property: '날짜', date: { on_or_before: endDate } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`${NOTION_API_BASE}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      throw new Error(err.message || `Notion API error: ${res.status}`);
    }
    const data = await res.json();
    for (const p of data.results || []) pages.push(p);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export async function fetchVacations(startDate: string, endDate: string): Promise<VacationEntry[]> {
  const dbId = process.env.NOTION_VACATION_DB_ID;
  if (!dbId) throw new Error('NOTION_VACATION_DB_ID not set');

  const entries: VacationEntry[] = [];
  let cursor: string | undefined;

  do {
    const body: any = {
      page_size: 100,
      filter: {
        and: [
          { property: '날짜', date: { on_or_after: startDate } },
          { property: '날짜', date: { on_or_before: endDate } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API_BASE}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      throw new Error(err.message || `Notion API error: ${res.status}`);
    }

    const data = await res.json();
    for (const page of data.results || []) {
      const props = page.properties;
      const name = extractTitle(props);
      const date = props['날짜']?.date?.start || '';
      const type = extractTypeName(props['휴가제도']);
      if (!name || !date || !type) continue;
      entries.push({ name, date: date.slice(0, 10), type });
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return entries;
}
