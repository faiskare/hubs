import { addComponent, defineQuery, entityExists, exitQuery, hasComponent, removeComponent } from "bitecs";
import { HubsWorld } from "../app";
import { Constraint, EntityStateDirty, Owned } from "../bit-components";
import HubChannel from "../utils/hub-channel";
import { saveEntityState } from "../utils/hub-channel-utils";
import { hasSavedEntityState, localClientID } from "./networking";

const constraintExitQuery = exitQuery(defineQuery([Constraint, Owned]));
const entityStateDirtyQuery = defineQuery([EntityStateDirty, Owned]);
export function entityPersistenceSystem(world: HubsWorld, hubChannel: HubChannel) {
  if (!localClientID) return; // Not connected yet

  constraintExitQuery(world).forEach(function (eid) {
    if (entityExists(world, eid) && hasComponent(world, Owned, eid) && !hasComponent(world, Constraint, eid)) {
      addComponent(world, EntityStateDirty, eid);
    }
  });

  // TODO Is it necessary to duplicate this array (since we are calling removeComponent within)?
  Array.from(entityStateDirtyQuery(world)).forEach(function (eid) {
    if (hasSavedEntityState(world, eid)) {
      saveEntityState(hubChannel, world, eid);
    }
    removeComponent(world, EntityStateDirty, eid);
  });
}
