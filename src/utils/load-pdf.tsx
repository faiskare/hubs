/** @jsx createElementEntity */
import * as pdfjs from "pdfjs-dist";
import { HubsWorld } from "../app";
import { createElementEntity, renderAsEntity } from "../utils/jsx-entity";

export function* loadPDF(world: HubsWorld, _flags: number, url: string) {
  const pdf = (yield pdfjs.getDocument(url).promise) as pdfjs.PDFDocumentProxy;

  // TODO Should we create the canvas texture here and load/render the first page?

  // TODO Use flags to determine whether this should be a controllable object

  return renderAsEntity(
    world,
    <entity name="PDF" networked grabbable={{ cursor: true, hand: false }} pdf={{ pdf }}></entity>
  );
}
