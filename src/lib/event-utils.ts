import { DisplayEvent } from '@/types';

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
  '#면접': 'interview',
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
    interview: '#면접',
  };
  return reverseMap[template] || '';
}
