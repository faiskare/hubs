import { hasComponent } from "bitecs";
import { HubsWorld } from "../app";
import { Networked } from "../bit-components";
import { isCursorBufferUpdateMessage, storedUpdates } from "../bit-systems/network-receive-system";
import { localClientID } from "../bit-systems/networking";
import HubChannel from "./hub-channel";
import { messageForStorage } from "./message-for";
import type { DeleteEntityStatePayload, EntityID, NetworkID, SaveEntityStatePayload } from "./networking-types";
import { EntityStateList, StorableMessage } from "./networking-types";
import { takeOwnership } from "./take-ownership";

type HubChannelCommand =
  | "list_entity_states"
  | "save_entity_state"
  | "delete_entity_state"
  | "delete_entity_states_for_root_nid";
type HubChannelPayload = SaveEntityStatePayload | DeleteEntityStatePayload;

function push(hubChannel: HubChannel, command: HubChannelCommand, payload?: HubChannelPayload) {
  return new Promise((resolve, reject) => {
    hubChannel.channel.push(command, payload).receive("ok", resolve).receive("error", reject);
  });
}

function createSaveEntityStatePayload(world: HubsWorld, eid: EntityID, rootNid: NetworkID): SaveEntityStatePayload {
  const nid = APP.getString(Networked.id[eid])! as NetworkID;
  return {
    root_nid: rootNid,
    nid,
    message: messageForStorage(world, nid === rootNid ? [eid] : [], [eid], [])
  };
}

function createSaveEntityStatePayloadsForEntityHierarchy(world: HubsWorld, rootEid: EntityID) {
  // Save each entity state in the hierarchy independently,
  // so that each can be updated and deleted independently.

  const payloads: SaveEntityStatePayload[] = [];
  const rootNid = APP.getString(Networked.id[rootEid])! as NetworkID;
  world.eid2obj.get(rootEid)!.traverse(o => {
    if (o.eid && hasComponent(world, Networked, o.eid)) {
      takeOwnership(world, o.eid);
      Networked.creator[o.eid] = APP.getSid("reticulum");
      payloads.push(createSaveEntityStatePayload(world, o.eid, rootNid));
    }
  });

  // Include stored updates about this entity or its descendants.
  // These updates are valid, even if we have not been able to apply them yet
  // (e.g. if nested media is still loading or failed to load).
  //
  // TODO This is complicated and may be unnecessary. Should we ignore this scenario?
  storedUpdates.forEach(updates => {
    updates.forEach(update => {
      if (!update.nid.startsWith(rootNid)) return; // Stored update is unrelated to this hierarchy.
      if (isCursorBufferUpdateMessage(update)) return; // We can only store StorableUpdates.

      let payload = payloads.find(p => p.nid === update.nid);
      if (!payload) {
        payload = {
          root_nid: rootNid,
          nid: update.nid,
          message: { version: 1, creates: [], updates: [], deletes: [] }
        };
        payloads.push(payload);
      }

      payload.message.updates.push(update);
    });
  });

  return payloads;
}

export async function saveEntityState(hubChannel: HubChannel, world: HubsWorld, eid: EntityID) {
  if (!localClientID) throw new Error("Tried to save entity state before connected to hub channel.");

  takeOwnership(world, eid);
  Networked.creator[eid] = APP.getSid("reticulum");

  const payload = createSaveEntityStatePayload(world, eid, APP.getString(Networked.id[eid])!.split(".")[0]);
  return push(hubChannel, "save_entity_state", payload);
}

export async function saveEntityStateHierarchy(hubChannel: HubChannel, world: HubsWorld, eid: EntityID) {
  if (!localClientID) throw new Error("Tried to save entity state hierarchy before connected to hub channel.");

  const payloads = createSaveEntityStatePayloadsForEntityHierarchy(world, eid);
  console.log("Saving entity states for entity hierarchy:", payloads);
  return Promise.all(
    payloads.map(payload => {
      return push(hubChannel, "save_entity_state", payload);
    })
  );
}

function _deleteEntityState(hubChannel: HubChannel, world: HubsWorld, eid: EntityID, full: boolean) {
  if (!localClientID)
    throw new Error(`Tried to delete entity state ${full ? "hierarchy " : ""}before connected to hub channel.`);

  takeOwnership(world, eid);
  Networked.creator[eid] = APP.getSid(localClientID);

  const payload: DeleteEntityStatePayload = {
    nid: APP.getString(Networked.id[eid])! as NetworkID,
    message: messageForStorage(world, [eid], [eid], [])
  };

  return push(hubChannel, full ? "delete_entity_states_for_root_nid" : "delete_entity_state", payload);
}

export async function deleteEntityStateHierarchy(hubChannel: HubChannel, world: HubsWorld, eid: EntityID) {
  _deleteEntityState(hubChannel, world, eid, true);
}

export async function deleteEntityState(hubChannel: HubChannel, world: HubsWorld, eid: EntityID) {
  _deleteEntityState(hubChannel, world, eid, false);
}

export function listEntityStates(hubChannel: HubChannel) {
  return push(hubChannel, "list_entity_states") as Promise<EntityStateList>;
}

export function parseStorableMessages(list: EntityStateList): StorableMessage[] {
  return list.data.map(entityState => {
    entityState.message.fromClientId = "reticulum";
    entityState.message.updates.forEach(u => (u.owner = "reticulum"));
    return entityState.message;
  });
}
