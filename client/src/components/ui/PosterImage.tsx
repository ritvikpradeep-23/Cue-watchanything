interface PosterImageProps {
  src: string;
  alt: string;
  className?: string;
  /** forces full color, e.g. while a swipe card is being dragged */
  active?: boolean;
}

export function PosterImage({ src, alt, className = "", active = false }: PosterImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`poster-image object-cover ${active ? "poster-image--active" : ""} ${className}`}
    />
  );
}
