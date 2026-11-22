interface Props {
  caption: string;
  columns: [string, string];
  rows: [string, number][];
}

/**
 * The numbers behind a chart, collapsed by default. Gives screen-reader users
 * the data (canvas charts are opaque) and lets anyone read or copy exact values.
 */
export default function DataTable({ caption, columns, rows }: Props) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted hover:text-fg">Show data</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface text-left">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-medium">
                {columns[0]}
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-line">
                <td className="px-3 py-1 break-words">{label}</td>
                <td className="px-3 py-1 text-right font-mono tabular-nums">
                  {value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
