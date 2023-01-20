import { hasComponent } from "bitecs";
import { HubsWorld } from "../app";
import { Networked } from "../bit-components";
import { storedUpdates } from "../bit-systems/network-receive-system";
import { localClientID } from "../bit-systems/networking";
import { selfWithDescendants } from "./bit-utils";
import HubChannel from "./hub-channel";
import { messageFor, messageForStorage } from "./message-for";
import type { EntityID, Message, NetworkID } from "./networking-types";
import { takeOwnership } from "./take-ownership";

export interface StorableMessage extends Message {
  version: 1;
}

function storableMessageFor(world: HubsWorld, eid: EntityID) {
  const nid = APP.getString(Networked.id[eid])!;
  const storableMessage = messageForStorage(
    world,
    [eid],
    selfWithDescendants(world, eid).filter(eid => hasComponent(world, Networked, eid)),
    []
  );
  // We may have stored updates about this entity or its descendants,
  // which can happen if media fails to load. Include those stored messages
  // when pinning so that we don't lose this data.
  storedUpdates.forEach((updates, storedNid) => {
    if (APP.getString(storedNid)!.startsWith(nid)) {
      storableMessage!.updates.push(...updates);
    }
  });
  return storableMessage;
}

export async function tryPin(world: HubsWorld, eid: EntityID, hubChannel: HubChannel) {
  if (!localClientID) throw new Error("Tried to unpin before connected to the channel...");
  takeOwnership(world, eid);
  Networked.creator[eid] = APP.getSid("reticulum");
  const nid = APP.getString(Networked.id[eid])!;
  const message = storableMessageFor(world, eid);
  const fileId = null;
  const fileAccessToken = null;
  const promotionToken = null;
  // TODO Support file uploads, promotion, etc
  console.log("Saving entity state", {
    nid,
    message,
    fileId,
    fileAccessToken,
    promotionToken
  });
  await hubChannel.saveEntityState(nid, message, fileId, fileAccessToken, promotionToken);
}

export async function tryUnpin(world: HubsWorld, eid: EntityID, hubChannel: HubChannel) {
  if (!localClientID) throw new Error("Tried to unpin before connected to the channel...");
  takeOwnership(world, eid);
  Networked.creator[eid] = APP.getSid(localClientID!);
  const message = storableMessageFor(world, eid);
  const fileId = null;
  const nid = APP.getString(Networked.id[eid])!;
  console.log("Deleting saved entity state.", {
    nid,
    message,
    fileId
  });
  await hubChannel.deleteEntityState(nid, message, fileId);
}
