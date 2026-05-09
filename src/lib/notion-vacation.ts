const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface VacationEntry {
  name: string;
  date: string; // YYYY-MM-DD
  type: string;
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

function extractTypeName(prop: any, typeMap?: Map<string, string>): string {
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
      return extractTypeName(r.array[0], typeMap);
    }
  }
  if (prop.type === 'relation' && typeMap) {
    const ids: string[] = (prop.relation || []).map((r: any) => r.id);
    for (const id of ids) {
      const n = typeMap.get(id);
      if (n) return n;
    }
  }
  return '';
}

async function fetchDatabaseSchema(dbId: string): Promise<any> {
  const res = await fetch(`${NOTION_API_BASE}/databases/${dbId}`, {
    method: 'GET',
    headers: notionHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err.message || `Schema fetch error: ${res.status}`);
  }
  return res.json();
}

async function queryDatabaseAll(dbId: string, body: any = {}): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const reqBody: any = { page_size: 100, ...body };
    if (cursor) reqBody.start_cursor = cursor;
    const res = await fetch(`${NOTION_API_BASE}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(reqBody),
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

// 휴가제도 마스터 DB(연차/반차/...)의 pageId → 이름 맵 생성
// 통합이 마스터 DB에 접근 권한이 없으면 빈 맵 반환
async function fetchTypeMap(): Promise<Map<string, string>> {
  const dbId = process.env.NOTION_VACATION_DB_ID;
  if (!dbId) return new Map();

  const map = new Map<string, string>();

  // 1) 명시적 마스터 DB ID 환경변수 우선
  let masterDbId = process.env.NOTION_VACATION_TYPE_DB_ID;

  // 2) 없으면 부모 DB 스키마에서 휴가제도 relation 타겟 추출
  if (!masterDbId) {
    try {
      const schema = await fetchDatabaseSchema(dbId);
      const typeProp = schema.properties?.['휴가제도'];
      if (typeProp?.type === 'relation') {
        masterDbId = typeProp.relation?.database_id;
      }
    } catch {
      return map;
    }
  }

  if (!masterDbId) return map;

  try {
    const pages = await queryDatabaseAll(masterDbId);
    for (const page of pages) {
      const name = extractTitle(page.properties || {});
      if (name) map.set(page.id, name);
    }
  } catch {
    // 통합이 마스터 DB에 access 없음
  }

  return map;
}

export async function fetchVacationsRaw(startDate: string, endDate: string): Promise<any[]> {
  const dbId = process.env.NOTION_VACATION_DB_ID;
  if (!dbId) throw new Error('NOTION_VACATION_DB_ID not set');
  return queryDatabaseAll(dbId, {
    filter: {
      and: [
        { property: '날짜', date: { on_or_after: startDate } },
        { property: '날짜', date: { on_or_before: endDate } },
      ],
    },
  });
}

export async function fetchVacations(startDate: string, endDate: string): Promise<VacationEntry[]> {
  const [pages, typeMap] = await Promise.all([
    fetchVacationsRaw(startDate, endDate),
    fetchTypeMap(),
  ]);

  const entries: VacationEntry[] = [];
  for (const page of pages) {
    const props = page.properties;
    const name = extractTitle(props);
    const date = props['날짜']?.date?.start || '';
    const type = extractTypeName(props['휴가제도'], typeMap);
    if (!name || !date || !type) continue;
    entries.push({ name, date: date.slice(0, 10), type });
  }
  return entries;
}

export async function fetchTypeMapDebug(): Promise<Record<string, string>> {
  const m = await fetchTypeMap();
  return Object.fromEntries(m);
}
