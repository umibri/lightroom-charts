function Load() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Load a catalog</h1>
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="mb-2">
          Drag & drop a <code>.lrcat</code> or <code>.db</code> file here
        </p>
        <p className="text-sm text-gray-600">…or use the file picker (coming next)</p>
      </div>
    </section>
  );
}

export default Load;
