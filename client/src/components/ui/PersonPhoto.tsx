interface PersonPhotoProps {
  src: string | null;
  name: string;
  className?: string;
}

/** Same role as PosterImage but for actor/director headshots — falls back to a clearly-flagged
 * placeholder (initials on a flat surface) rather than a broken image when photoUrl is null,
 * i.e. still unresolved by the photo-fetch pipeline. */
export function PersonPhoto({ src, name, className = "" }: PersonPhotoProps) {
  if (!src) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <div
        className={`flex items-center justify-center bg-[var(--bg-sunken)] text-2xl font-normal text-[var(--text-muted)] ${className}`}
        aria-label={`${name} (photo not yet available)`}
      >
        {initials || "?"}
      </div>
    );
  }
  return <img src={src} alt={name} loading="lazy" className={`object-cover ${className}`} />;
}
