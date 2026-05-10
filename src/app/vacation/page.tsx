import { fetchVacations, VacationEntry } from '@/lib/notion-vacation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function dateFromYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function isHalfDay(t: string): boolean {
  return t.includes('반차');
}

function getWeekRange(today: Date): { monday: Date; friday: Date } {
  const dow = today.getUTCDay();
  const offset = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + offset);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { monday, friday };
}

function dedupe(items: VacationEntry[]): VacationEntry[] {
  const seen = new Set<string>();
  return items.filter(e => {
    const k = `${e.name}|${e.type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default async function VacationPage() {
  const today = kstNow();
  const todayStr = ymd(today);
  const { monday, friday } = getWeekRange(today);

  let entries: VacationEntry[] = [];
  let error: string | null = null;
  try {
    entries = await fetchVacations(ymd(monday), ymd(friday));
  } catch (e: any) {
    error = e?.message || 'Failed to load';
  }

  const datesByName = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!datesByName.has(e.name)) datesByName.set(e.name, new Set());
    datesByName.get(e.name)!.add(e.date);
  }

  const todayList = dedupe(entries.filter(e => e.date === todayStr));

  const byDate = new Map<string, VacationEntry[]>();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
  const weekDates = Array.from(byDate.keys()).sort();

  const yy = String(today.getUTCFullYear()).slice(2);
  const m = today.getUTCMonth() + 1;
  const d = today.getUTCDate();
  const headerDate = `${yy}년 ${m}월 ${d}일(${DOW[today.getUTCDay()]})`;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <meta httpEquiv="refresh" content="600" />
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">오늘의 휴가자</h1>
          <p className="text-gray-500 mt-1">{headerDate}</p>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            데이터를 불러오지 못했습니다: {error}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {todayList.length === 0 ? (
            <p className="text-gray-500">오늘 휴가자 없음</p>
          ) : (
            <ul className="space-y-2">
              {todayList.map((e, i) => {
                const allDates = Array.from(datesByName.get(e.name) || []).sort();
                const days = allDates.length > 1
                  ? `(${allDates.map(x => Number(x.slice(8, 10))).join(',')})`
                  : '';
                const half = isHalfDay(e.type);
                return (
                  <li key={i} className="text-lg leading-relaxed">
                    {half && <span className="mr-1">{HALF_ICON}</span>}
                    <span className="font-bold" style={{ color: NAME_COLOR }}>{e.name}</span>
                    <span className="text-gray-700"> · {e.type}{days}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">이번주 휴가자</h2>
          {weekDates.length === 0 ? (
            <p className="text-gray-500">이번주 휴가자 없음</p>
          ) : (
            <div className="space-y-3">
              {weekDates.map(date => {
                const dt = dateFromYmd(date);
                const mm = dt.getUTCMonth() + 1;
                const dd = dt.getUTCDate();
                const dowChar = DOW[dt.getUTCDay()];
                const isToday = date === todayStr;
                const items = dedupe(byDate.get(date)!);
                return (
                  <div key={date} className="flex gap-3 items-baseline">
                    <div className={`w-20 shrink-0 font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {mm}/{dd}({dowChar})
                    </div>
                    <div className="flex-1 leading-relaxed">
                      {items.map((it, i) => {
                        const half = isHalfDay(it.type);
                        return (
                          <span key={i}>
                            {i > 0 && <span className="text-gray-400">, </span>}
                            {half && <span className="mr-0.5">{HALF_ICON}</span>}
                            <span className="font-bold" style={{ color: NAME_COLOR }}>{it.name}</span>
                            {half && <span className="text-gray-600">({it.type})</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="text-xs text-gray-400 text-center pt-4">
          10분마다 자동 새로고침
        </footer>
      </div>
    </main>
  );
}
