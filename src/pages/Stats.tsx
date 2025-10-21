function Stats() {
  return (
    <section className="grid gap-6 md:grid-cols-4">
      <aside className="md:col-span-1 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Filters</h2>
        <div className="rounded-lg border p-3 text-sm text-gray-600">
          Date presets / Lens / Camera (TBD)
        </div>
      </aside>
      <div className="md:col-span-3 space-y-4">
        <h1 className="text-xl font-semibold">Stats</h1>
        <div className="rounded-lg border p-8 text-center text-gray-600">
          Timeline chart placeholder
        </div>
        <div className="rounded-lg border p-8 text-center text-gray-600">
          Lens / Camera chart placeholders
        </div>
      </div>
    </section>
  );
}

export default Stats;
