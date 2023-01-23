import { addComponent, defineQuery, entityExists, exitQuery, hasComponent, removeComponent } from "bitecs";
import { HubsWorld } from "../app";
import { Constraint, EntityStateDirty, Owned } from "../bit-components";
import { coroutine, crNextFrame } from "../utils/coroutine";
import HubChannel from "../utils/hub-channel";
import { saveEntityState } from "../utils/hub-channel-utils";
import { EntityID } from "../utils/networking-types";
import { hasSavedEntityState, localClientID } from "./networking";

const timers = new Map<EntityID, number>();
// Use coroutines and timers to throttle calls to saveEntityState,
// so that rapid changes to network state (e.g. scrubbing a video playhead)
// does not flood reticulum.
function* saveEntityStateJob(hubChannel: HubChannel, world: HubsWorld, eid: EntityID, maxDelay: number) {
  while (world.time.elapsed < timers.get(eid)! && world.time.elapsed < maxDelay) {
    yield crNextFrame();
  }
  saveEntityState(hubChannel, world, eid);
}

// TODO type for coroutine
type Coroutine = () => IteratorResult<undefined, any>;
const jobs = new Map<EntityID, Coroutine>();
const saveDelayMS = 500;
const maxSaveDelayMS = 3000;

const constraintExitQuery = exitQuery(defineQuery([Constraint, Owned]));
const ownedExitQuery = exitQuery(defineQuery([Owned]));
const entityStateDirtyQuery = defineQuery([EntityStateDirty]);
export function entityPersistenceSystem(world: HubsWorld, hubChannel: HubChannel) {
  if (!localClientID) return; // Not connected yet

  constraintExitQuery(world).forEach(function (eid) {
    if (entityExists(world, eid) && hasComponent(world, Owned, eid) && !hasComponent(world, Constraint, eid)) {
      addComponent(world, EntityStateDirty, eid);
    }
  });

  // TODO Is it necessary to duplicate this array (since we are calling removeComponent within)?
  Array.from(entityStateDirtyQuery(world)).forEach(function (eid) {
    if (hasComponent(world, Owned, eid) && hasSavedEntityState(world, eid)) {
      timers.set(eid, world.time.elapsed + saveDelayMS);
      if (!jobs.has(eid)) {
        jobs.set(eid, coroutine(saveEntityStateJob(hubChannel, world, eid, world.time.elapsed + maxSaveDelayMS)));
      }
    }
    removeComponent(world, EntityStateDirty, eid);
  });

  // Don't both saving state if we lose ownership
  ownedExitQuery(world).forEach(function (eid) {
    jobs.delete(eid);
  });

  jobs.forEach((job, eid) => {
    if (job().done) jobs.delete(eid);
  });
}
