import { defineQuery } from "bitecs";
import { HubsWorld } from "../app";
import { Networked, Owned } from "../bit-components";
import HubChannel from "../utils/hub-channel";
import { saveEntityState } from "../utils/hub-channel-utils";
import { isPinned, localClientID } from "./networking";

const secondsBetweenSync = 10; // Tune this if we are writing too often
const millisecondsBetweenTicks = 1000 * secondsBetweenSync;
let nextTick = 0;

const ownedNetworkedQuery = defineQuery([Networked, Owned]);
export function entityPersistenceSystem(world: HubsWorld, hubChannel: HubChannel) {
  if (!localClientID) return; // Not connected yet

  const now = world.time.elapsed;
  if (now < nextTick) return;

  nextTick = now + millisecondsBetweenTicks;

  ownedNetworkedQuery(world).forEach(eid => {
    if (isPinned(eid)) {
      saveEntityState(hubChannel, world, eid);
    }
  });
}
