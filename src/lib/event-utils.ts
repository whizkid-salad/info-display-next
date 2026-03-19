import { DisplayEvent, QuickNotice } from '@/types';

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

const TAG_MAP: Record<string, DisplayEvent['template']> = {
  '#환영': 'welcome',
  '#생일': 'birthday',
  '#공지': 'notice',
  '#축하': 'celebration',
};

export function parseDescription(description: string | null | undefined): {
  template: DisplayEvent['template'];
  subtitle: string;
} {
  if (!description) return { template: 'default', subtitle: '' };

  const cleaned = stripHtml(description);
  const lines = cleaned.trim().split('\n');
  const firstLine = lines[0].trim();

  let template: DisplayEvent['template'] = 'default';
  let subtitleStart = 0;

  for (const [tag, name] of Object.entries(TAG_MAP)) {
    if (firstLine.startsWith(tag)) {
      template = name;
      const afterTag = firstLine.slice(tag.length).trim();
      if (afterTag) {
        lines[0] = afterTag;
        subtitleStart = 0;
      } else {
        subtitleStart = 1;
      }
      break;
    }
  }

  const subtitle = lines.slice(subtitleStart).join('\n').trim();
  return { template, subtitle };
}

export function templateToTag(template: string): string {
  const reverseMap: Record<string, string> = {
    welcome: '#환영',
    birthday: '#생일',
    notice: '#공지',
    celebration: '#축하',
  };
  return reverseMap[template] || '';
}

export function mergeEvents(
  calendarEvents: DisplayEvent[],
  notices: QuickNotice[]
): DisplayEvent[] {
  // Convert supabase notices to DisplayEvent format
  const noticeEvents: DisplayEvent[] = notices
    .filter((n) => n.is_active && (!n.expires_at || new Date(n.expires_at) > new Date()))
    .map((n) => ({
      id: n.id,
      title: n.title,
      template: n.template as DisplayEvent['template'],
      subtitle: n.subtitle || '',
      start: n.created_at,
      end: n.expires_at || new Date(Date.now() + 86400000).toISOString(),
      source: 'supabase' as const,
    }));

  // Emergency notices (priority >= 100) come first
  const emergency = noticeEvents.filter((_, i) => notices[i]?.priority >= 100);
  const normal = noticeEvents.filter((_, i) => (notices[i]?.priority ?? 0) < 100);

  return [...emergency, ...calendarEvents, ...normal];
}
