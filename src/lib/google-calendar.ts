import { google, calendar_v3 } from 'googleapis';
import { DisplayEvent, CalendarEventInput } from '@/types';
import { parseDescription } from './event-utils';

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) return calendarClient;

  const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyString) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');

  const credentials = JSON.parse(keyString);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

const ALL_FLOORS = ['6', '8'];

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

  // G1 이벤트를 포함한 확장 윈도우 필터
  // upcoming: 시작 25분 전부터, post-event: 종료 10분 후까지
  const G1_PRE_MS = 25 * 60 * 1000;
  const G1_POST_MS = 15 * 60 * 1000;
  const nowMs = now.getTime();

  return (res.data.items || [])
    .filter((event) => {
      const start = new Date(event.start?.dateTime || event.start?.date || '').getTime();
      const end = new Date(event.end?.dateTime || event.end?.date || '').getTime();
      return (start - G1_PRE_MS) <= nowMs && nowMs <= (end + G1_POST_MS);
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
  const allEvents: DisplayEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });

    const events = (res.data.items || []).map((event) => {
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

    allEvents.push(...events);
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return allEvents;
}

/** 모든 층 캘린더에서 이벤트를 가져와 중복 제거 후 통합 목록 반환 */
export async function listAllFloorsEvents(
  timeMin: string,
  timeMax: string
): Promise<DisplayEvent[]> {
  // 각 층별로 병렬 조회
  const floorResults = await Promise.all(
    ALL_FLOORS.map(async (floor) => {
      try {
        const calendarId = getFloorCalendarId(floor);
        const events = await listEventsForRange(calendarId, timeMin, timeMax);
        return events.map((e) => ({ ...e, _floor: floor, _originalId: e.id }));
      } catch {
        return [];
      }
    })
  );

  // 중복 제거: title + start + end 기준으로 그룹핑
  const groupMap = new Map<string, DisplayEvent & { floors: string[]; eventIds: Record<string, string> }>();

  for (let fi = 0; fi < ALL_FLOORS.length; fi++) {
    const floor = ALL_FLOORS[fi];
    for (const event of floorResults[fi]) {
      const key = `${event.title}|${event.start}|${event.end}`;
      const existing = groupMap.get(key);
      if (existing) {
        if (!existing.floors.includes(floor)) {
          existing.floors.push(floor);
        }
        existing.eventIds[floor] = event._originalId;
      } else {
        groupMap.set(key, {
          id: event._originalId,
          title: event.title,
          template: event.template,
          subtitle: event.subtitle,
          start: event.start,
          end: event.end,
          source: 'calendar',
          floors: [floor],
          eventIds: { [floor]: event._originalId },
        });
      }
    }
  }

  // 시작시간 순 정렬
  return Array.from(groupMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
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
