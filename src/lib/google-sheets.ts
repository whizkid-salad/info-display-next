import { google } from 'googleapis';
import { getSupabaseClient } from './supabase-server';

const SPREADSHEET_ID = '1a5DZmCpRW6BrdgkpTElJyrSswvpsFcpkFVLCgomQ2Kk';

// ── 기본 컬럼 매핑 (Supabase에 config 없을 때 폴백) ──────────
export interface ProductMetricColumns {
  onboarding: string;
  service_start: string;
  service_stop: string;
  live_count: string;
}

export interface SheetConfig {
  key: string;            // 'hosting' | 'imweb'
  sheetName: string;
  products: Record<string, ProductMetricColumns>;
}

export interface ChartTheme {
  preset: string;
  colors: Record<string, string>;  // product → hex color
  gridColor: string;
  textColor: string;
}

export const THEME_PRESETS: Record<string, ChartTheme> = {
  default: {
    preset: 'default',
    colors: { review: '#3b82f6', upsell: '#22c55e', push: '#f97316', imweb: '#a855f7' },
    gridColor: 'rgba(255,255,255,0.08)',
    textColor: 'rgba(255,255,255,0.5)',
  },
  neon: {
    preset: 'neon',
    colors: { review: '#0abdc6', upsell: '#ea00d9', push: '#39ff14', imweb: '#ff6ec7' },
    gridColor: 'rgba(0,255,255,0.06)',
    textColor: 'rgba(0,255,255,0.5)',
  },
  mono: {
    preset: 'mono',
    colors: { review: '#94a3b8', upsell: '#cbd5e1', push: '#64748b', imweb: '#e2e8f0' },
    gridColor: 'rgba(255,255,255,0.05)',
    textColor: 'rgba(255,255,255,0.4)',
  },
  ocean: {
    preset: 'ocean',
    colors: { review: '#06b6d4', upsell: '#0ea5e9', push: '#6366f1', imweb: '#8b5cf6' },
    gridColor: 'rgba(99,102,241,0.08)',
    textColor: 'rgba(147,197,253,0.5)',
  },
  sunset: {
    preset: 'sunset',
    colors: { review: '#f59e0b', upsell: '#ef4444', push: '#ec4899', imweb: '#f97316' },
    gridColor: 'rgba(251,146,60,0.08)',
    textColor: 'rgba(253,186,116,0.5)',
  },
};

export interface RollingConfig {
  views: string[];       // ['daily', 'weekly', 'counter'] 순서대로
  interval: number;      // 초 단위 (기본 15)
}

export interface MetricsSheetConfig {
  spreadsheetId: string;
  sheets: SheetConfig[];
  theme?: ChartTheme;
  rolling?: RollingConfig;
}

const DEFAULT_CONFIG: MetricsSheetConfig = {
  spreadsheetId: SPREADSHEET_ID,
  sheets: [
    {
      key: 'hosting',
      sheetName: '[호스팅사 통합] 샐러드랩 핵심지표 정리',
      products: {
        review: { onboarding: 'B', service_start: 'E', service_stop: 'H', live_count: 'M' },
        upsell: { onboarding: 'N', service_start: 'Q', service_stop: 'T', live_count: 'Y' },
        push:   { onboarding: 'Z', service_start: 'AC', service_stop: 'AF', live_count: 'AM' },
      },
    },
    {
      key: 'imweb',
      sheetName: '아임웹 핵심지표 정리',
      products: {
        imweb: { onboarding: 'B', service_start: 'E', service_stop: 'H', live_count: 'M' },
      },
    },
  ],
};

// ── Supabase에서 config 조회 (없으면 기본값) ──────────────────
export async function getMetricsConfig(): Promise<MetricsSheetConfig> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('metrics_config')
      .select('*')
      .eq('id', 'default')
      .single();

    if (data) {
      return {
        spreadsheetId: data.spreadsheet_id,
        sheets: data.sheets as SheetConfig[],
        theme: (data.theme as ChartTheme) || THEME_PRESETS.default,
        rolling: (data.rolling as RollingConfig) || { views: ['daily', 'weekly', 'counter'], interval: 15 },
      };
    }
  } catch {
    // 테이블이 없거나 데이터 없으면 기본값 사용
  }
  return DEFAULT_CONFIG;
}

// ── config 저장 ───────────────────────────────────────────────
export async function saveMetricsConfig(config: MetricsSheetConfig): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('metrics_config').upsert({
    id: 'default',
    spreadsheet_id: config.spreadsheetId,
    sheets: config.sheets,
    theme: config.theme || THEME_PRESETS.default,
    rolling: config.rolling || { views: ['daily', 'weekly', 'counter'], interval: 15 },
  }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

// ── Column letter → 0-based index ─────────────────────────────
function colToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// ── Sheets 클라이언트 ─────────────────────────────────────────
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyString) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');

  const credentials = JSON.parse(keyString);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ── 날짜 파싱 ─────────────────────────────────────────────────
function parseSheetDate(raw: string | number | undefined): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  // Google Sheets 시리얼 넘버 (숫자)
  if (typeof raw === 'number' || /^\d{4,5}(\.\d+)?$/.test(String(raw))) {
    const serial = Number(raw);
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + serial * 86400000);
    return date.toISOString().split('T')[0];
  }

  const s = String(raw).trim();

  // ISO: 2026-03-18
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;

  // Korean: 2026. 3. 18. 또는 2026.03.18
  const krMatch = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (krMatch) return `${krMatch[1]}-${krMatch[2].padStart(2, '0')}-${krMatch[3].padStart(2, '0')}`;

  // US: 03/18/2026
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;

  return null;
}

// ── 셀 값 → 숫자 ─────────────────────────────────────────────
function parseNumericCell(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const s = String(raw).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

// ── 메인: 스프레드시트에서 데이터 가져오기 ───────────────────
export interface SheetMetricRow {
  date: string;       // YYYY-MM-DD
  product: string;    // review | upsell | push | imweb
  metric: string;     // onboarding | service_start | service_stop | live_count
  value: number;
}

/**
 * @param days - 최근 N일만 가져오기. 0이면 전체(마이그레이션용)
 * @param config - 컬럼 매핑 (없으면 Supabase/기본값 사용)
 */
export async function fetchMetricsFromSheets(
  days: number = 7,
  config?: MetricsSheetConfig,
): Promise<SheetMetricRow[]> {
  const cfg = config || await getMetricsConfig();
  const sheets = getSheetsClient();
  const results: SheetMetricRow[] = [];

  for (const sheetCfg of cfg.sheets) {
    // 가장 큰 컬럼 인덱스 계산해서 범위 최적화
    let maxColIdx = 0;
    for (const metrics of Object.values(sheetCfg.products)) {
      for (const col of Object.values(metrics)) {
        maxColIdx = Math.max(maxColIdx, colToIndex(col));
      }
    }
    // 인덱스 → 열 문자로 변환
    const maxColLetter = indexToCol(maxColIdx);
    const range = `'${sheetCfg.sheetName}'!A2:${maxColLetter}`;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const allRows = res.data.values || [];

    // 빈 행 필터 (A열이 비어있으면 스킵)
    const validRows = allRows.filter((row) => row[0] !== undefined && row[0] !== '');

    // days=0이면 전체, 아니면 날짜 기준 N일치 (행 수가 아닌 실제 날짜 범위)
    let targetRows = validRows;
    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
      const cutoffStr = cutoff.toISOString().split('T')[0]; // 'YYYY-MM-DD'
      targetRows = validRows.filter((row) => {
        const d = parseSheetDate(row[0]);
        return d !== null && d >= cutoffStr;
      });
    }

    for (const row of targetRows) {
      const date = parseSheetDate(row[0]);
      if (!date) continue;

      for (const [product, metrics] of Object.entries(sheetCfg.products)) {
        for (const [metric, col] of Object.entries(metrics)) {
          const idx = colToIndex(col);
          const value = parseNumericCell(row[idx]);
          results.push({ date, product, metric, value });
        }
      }
    }
  }

  return results;
}

// ── 인덱스 → 열 문자 변환 (0=A, 25=Z, 26=AA, ...) ───────────
function indexToCol(idx: number): string {
  let col = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}
