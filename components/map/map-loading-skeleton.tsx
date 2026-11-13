/** Map loading skeleton — fills the 700px map slot while GeoJSON or Mapbox loads */
export function MapLoadingSkeleton() {
  return (
    <div className="relative w-full h-full min-h-[600px] bg-muted rounded-lg animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading map...</p>
        </div>
      </div>
    </div>
  )
}
