/** @jsx createElementEntity */
import { createElementEntity } from "../utils/jsx-entity";
import { ProjectionMode } from "./projection-mode";
import { loadTextureCancellable } from "../utils/load-texture";
import { renderAsEntity } from "../utils/jsx-entity";
import { HubsWorld } from "../app";
import { Texture } from "three";
import { AlphaMode } from "./create-image-mesh";
import { MEDIA_LOADER_FLAGS } from "../bit-systems/media-loading";

export function* loadImage(world: HubsWorld, flags: number, url: string, contentType: string) {
  const { texture, ratio, cacheKey }: { texture: Texture; ratio: number; cacheKey: string } =
    yield loadTextureCancellable(url, 1, contentType);
  const projection =
    flags & MEDIA_LOADER_FLAGS.SPHERICAL_PROJECTION ? ProjectionMode.SPHERE_EQUIRECTANGULAR : ProjectionMode.FLAT;

  return renderAsEntity(
    world,
    <entity
      name="Image"
      image={{
        texture,
        ratio,
        projection,
        alphaMode: AlphaMode.Opaque,
        cacheKey
      }}
    />
  );
}
