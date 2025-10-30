import React from 'react';
import { query } from '@/lib/dbClient';

function StatsRoute() {
  const [ok, setOk] = React.useState<unknown>(null);
  const [err, setErr] = React.useState<string>('');

  React.useEffect(() => {
    (async () => {
      try {
        const rows = await query<{ ok: number }>('SELECT 1 AS ok');
        setOk(rows[0]?.ok);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setErr('Query failed');
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Stats</h1>
      {err ? (
        <div className="text-red-600">{err}</div>
      ) : (
        <pre className="text-sm">Smoke test: {JSON.stringify({ ok })}</pre>
      )}
      {/* Later: charts */}
    </div>
  );
}

export default StatsRoute;
