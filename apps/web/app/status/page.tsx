import { Nav } from '@/components/nav';
import { API_BASE_URL } from '@/lib/config';
import type { HealthDto } from '@booking/shared';

export const dynamic = 'force-dynamic';

async function fetchHealth(): Promise<HealthDto | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    return (await res.json()) as HealthDto;
  } catch {
    return null;
  }
}

function dot(ok: boolean) {
  return <span className={`badge ${ok ? 'badge-ok' : 'badge-err'}`}>{ok ? 'up' : 'down'}</span>;
}

export default async function StatusPage() {
  const health = await fetchHealth();

  return (
    <>
      <Nav />
      <div className="container">
        <h1>Service status</h1>
        {!health ? (
          <div className="card error">API is unreachable.</div>
        ) : (
          <div className="card">
            <div className="row between">
              <h3 style={{ margin: 0 }}>Overall</h3>
              {health.status === 'ok' ? (
                <span className="badge badge-ok">operational</span>
              ) : (
                <span className="badge badge-warn">degraded</span>
              )}
            </div>
            <table style={{ marginTop: 12 }}>
              <tbody>
                <tr>
                  <td>API</td>
                  <td>{dot(true)}</td>
                </tr>
                <tr>
                  <td>Database (Postgres)</td>
                  <td>{dot(health.db)}</td>
                </tr>
                <tr>
                  <td>Redis</td>
                  <td>{dot(health.redis)}</td>
                </tr>
                <tr>
                  <td>Worker</td>
                  <td>{dot(health.worker)}</td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 12 }}>
              API uptime: {health.uptimeSeconds}s
            </p>
          </div>
        )}
      </div>
    </>
  );
}
