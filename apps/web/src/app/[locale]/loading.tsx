/** Skeleton shown while a route segment streams from the API. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card overflow-hidden">
            <div className="skeleton aspect-square w-full" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
