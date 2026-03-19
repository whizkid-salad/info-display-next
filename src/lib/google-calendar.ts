import { google, calendar_v3 } from 'googleapis';
import { DisplayEvent, CalendarEventInput } from '@/types';
import { parseDescription, templateToTag } from './event-utils';

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) return calendarClient;

  const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyString) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');

  const credentials = JSON.parse(keyString);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

export function getFloorCalendarId(floor: string): string {
  const map: Record<string, string | undefined> = {
    '6': process.env.CALENDAR_ID_6F,
    '8': process.env.CALENDAR_ID_8F,
  };
  const id = map[floor];
  if (!id) throw new Error(`No calendar ID for floor ${floor}`);
  return id;
}

export async function getActiveEvents(calendarId: string): Promise<DisplayEvent[]> {
  if (!calendarId) return [];

  const calendar = getCalendarClient();
  const now = new Date();
  const timeMin = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 12 * 3600 * 1000).toISOString();

  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || [])
    .filter((event) => {
      const start = new Date(event.start?.dateTime || event.start?.date || '');
      const end = new Date(event.end?.dateTime || event.end?.date || '');
      return start <= now && now <= end;
    })
    .map((event) => {
      const { template, subtitle } = parseDescription(event.description);
      return {
        id: event.id || '',
        title: event.summary || '',
        template,
        subtitle,
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        source: 'calendar' as const,
      };
    });
}

export async function listEventsForRange(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<DisplayEvent[]> {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return (res.data.items || []).map((event) => {
    const { template, subtitle } = parseDescription(event.description);
    return {
      id: event.id || '',
      title: event.summary || '',
      template,
      subtitle,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      source: 'calendar' as const,
    };
  });
}

export async function createCalendarEvent(
  calendarId: string,
  input: CalendarEventInput
): Promise<string> {
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start, timeZone: 'Asia/Seoul' },
      end: { dateTime: input.end, timeZone: 'Asia/Seoul' },
    },
  });
  return res.data.id || '';
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<void> {
  const calendar = getCalendarClient();
  const body: calendar_v3.Schema$Event = {};
  if (input.summary) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.start) body.start = { dateTime: input.start, timeZone: 'Asia/Seoul' };
  if (input.end) body.end = { dateTime: input.end, timeZone: 'Asia/Seoul' };

  await calendar.events.patch({ calendarId, eventId, requestBody: body });
}

export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId, eventId });
}
