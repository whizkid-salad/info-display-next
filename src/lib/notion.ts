const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

export interface NotionMember {
  notionId: string;
  name: string;
  email: string;
  birthday: string | null;  // YYYY-MM-DD
  hireDate: string | null;  // YYYY-MM-DD
}

export async function fetchNotionMembers(): Promise<NotionMember[]> {
  const dbId = process.env.NOTION_MEMBERS_DB_ID;
  if (!dbId) throw new Error('NOTION_MEMBERS_DB_ID not set');

  const members: NotionMember[] = [];
  let cursor: string | undefined;

  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API_BASE}/databases/${dbId}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Notion API error');
    }

    const data = await res.json();
    for (const page of data.results || []) {
      const props = page.properties;
      const name = props['이름']?.title?.[0]?.plain_text || '';
      if (!name) continue;
      members.push({
        notionId: page.id,
        name,
        email: props['이메일']?.rich_text?.[0]?.plain_text || '',
        birthday: props['생일']?.date?.start || null,
        hireDate: props['입사일']?.date?.start || null,
      });
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return members;
}
