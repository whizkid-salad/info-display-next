import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMetricsConfig, saveMetricsConfig, THEME_PRESETS } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/** GET /api/metrics/config — 현재 설정 + 테마 프리셋 목록 조회 */
export async function GET() {
  try {
    const config = await getMetricsConfig();
    return NextResponse.json({
      ok: true,
      config,
      themePresets: THEME_PRESETS,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/** PUT /api/metrics/config — 설정 수정 (컬럼 매핑 + 테마) */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { spreadsheetId, sheets, theme, rolling } = body;

    if (!spreadsheetId || !sheets || !Array.isArray(sheets)) {
      return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    await saveMetricsConfig({ spreadsheetId, sheets, theme, rolling });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
