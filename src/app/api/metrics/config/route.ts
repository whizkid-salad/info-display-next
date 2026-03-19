import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMetricsConfig, saveMetricsConfig } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/** GET /api/metrics/config — 현재 컬럼 매핑 조회 */
export async function GET() {
  try {
    const config = await getMetricsConfig();
    return NextResponse.json({ ok: true, config });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/** PUT /api/metrics/config — 컬럼 매핑 수정 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { spreadsheetId, sheets } = body;

    if (!spreadsheetId || !sheets || !Array.isArray(sheets)) {
      return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    await saveMetricsConfig({ spreadsheetId, sheets });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
