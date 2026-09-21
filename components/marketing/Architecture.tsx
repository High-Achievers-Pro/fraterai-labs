import Image from "next/image";

export function Architecture({
  name,
  className = "",
  preload = false,
  alt = "",
}: {
  name: string;
  className?: string;
  preload?: boolean;
  alt?: string;
}) {
  return (
    <div className={`architecture ${className}`}>
      <Image
        src={`/images/engravings/${name}.webp`}
        alt={alt}
        fill
        sizes={
          preload
            ? "(max-width: 767px) 100vw, 65vw"
            : "(max-width: 767px) 100vw, 50vw"
        }
        preload={preload}
      />
    </div>
  );
}
