import { localClientID, pendingMessages } from "../bit-systems/networking";
import HubChannel from "./hub-channel";
import { messageForLegacyRoomObjects } from "./message-for";
import { getReticulumFetchUrl } from "./phoenix-utils";
import { StorableMessage } from "./store-networked-state";

type LegacyRoomObject = any;
type StoredRoomDataNode = LegacyRoomObject | StorableMessage;

type StoredRoomData = {
  asset: {
    version: "2.0";
    generator: "reticulum";
  };
  scenes: [{ nodes: number[]; name: "Room Objects" }];
  nodes: StoredRoomDataNode[];
  extensionsUsed: ["HUBS_components"];
};

type EntityState = {
  message_id: string;
  entity_id: string;
  version: 1;
  blob: string; // Parse this to a StorableMessage
};

type EntityStateList = {
  data: EntityState[];
};

export function isStorableMessage(node: any): node is StorableMessage {
  return !!(node.version && node.creates && node.updates && node.deletes);
}

async function fetchSavedEntityStates(hubChannel: HubChannel) {
  const entityStateList: EntityStateList = await hubChannel.listEntityStates();
  const messages: StorableMessage[] = entityStateList.data.map(es => JSON.parse(es.blob));
  messages.forEach(m => {
    m.fromClientId = "reticulum";
    m.updates.forEach(update => {
      update.owner = "reticulum";
    });
  });
  return messages;
}

export async function loadSavedEntityStates(hubChannel: HubChannel, hubId: string) {
  const messages = await fetchSavedEntityStates(hubChannel);
  if (hubId === APP.hub!.hub_id) {
    if (!localClientID) {
      throw new Error("Cannot apply stored messages without a local client ID");
    }
    messages.forEach(m => {
      pendingMessages.push(m);
    });
  }
}

export async function loadLegacyRoomObjects(hubId: string) {
  console.log("loading legacy room objects...");
  const objectsUrl = getReticulumFetchUrl(`/${hubId}/objects.gltf`) as URL;
  const response = await fetch(objectsUrl);
  const roomData: StoredRoomData = await response.json();
  const legacyRoomObjects: LegacyRoomObject[] = roomData.nodes.filter(node => !isStorableMessage(node));

  if (hubId === APP.hub!.hub_id) {
    const message = messageForLegacyRoomObjects(legacyRoomObjects);
    if (message) {
      message.fromClientId = "reticulum";

      pendingMessages.push(message);
      // TODO All clients must use the new loading path for this to work correctly,
      // because all clients must agree on which netcode to use (hubs networking
      // systems or networked aframe) for a given object.
    }
    console.log({ legacyRoomObjects, message });
  }
}
