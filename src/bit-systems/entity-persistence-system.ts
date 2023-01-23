import { defineQuery, entityExists, exitQuery, hasComponent } from "bitecs";
import { HubsWorld } from "../app";
import { Constraint, MediaPDF, NetworkedPDF, Owned } from "../bit-components";
import HubChannel from "../utils/hub-channel";
import { saveEntityState } from "../utils/hub-channel-utils";
import { hasSavedEntityState, localClientID } from "./networking";
import { PDFComponentMap } from "./pdf-system";

const constraintExitQuery = exitQuery(defineQuery([Constraint, Owned]));

const pdfQuery = defineQuery([NetworkedPDF, Owned]);

export function entityPersistenceSystem(world: HubsWorld, hubChannel: HubChannel) {
  if (!localClientID) return; // Not connected yet

  constraintExitQuery(world).forEach(function (eid) {
    if (
      entityExists(world, eid) &&
      hasComponent(world, Owned, eid) &&
      !hasComponent(world, Constraint, eid) &&
      hasSavedEntityState(world, eid)
    ) {
      // We dropped a persistent entity. Save its state
      saveEntityState(hubChannel, world, eid);
    }
  });

  pdfQuery(world).forEach(function (pdf) {
    const component = (MediaPDF.map as PDFComponentMap).get(pdf)!;
    if (component.persistenceDirtyFlag) {
      component.persistenceDirtyFlag = false;
      saveEntityState(hubChannel, world, pdf);
    }
  });
}
