import { useEmblemImage, type EmblemKind } from "./emblem-images.js";

/**
 * A rank or badge emblem for a DOM place (V7 station 10): the still image the
 * shared renderer draws once. Decorative — its name and rule are the text
 * beside it — and empty until drawn or where there is no WebGL.
 */
export function EmblemImage({
  kind,
  id,
  locked = false,
  size = 96,
}: {
  readonly kind: EmblemKind;
  readonly id: string;
  readonly locked?: boolean;
  readonly size?: number;
}) {
  const url = useEmblemImage(kind, id, { locked, size });
  return url ? (
    <img className="emblem-image" src={url} alt="" width={size} height={size} draggable={false} />
  ) : null;
}
