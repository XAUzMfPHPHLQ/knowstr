import crypto from "crypto";
import { Event, SimplePool } from "nostr-tools";
import { FinalizeEvent } from "./Apis";

export const KIND_SETTINGS = 11071;

export const KIND_VIEWS = 11074;
export const KIND_WORKSPACES = 11075;
export const KIND_RELATION_TYPES = 11076;

export const KIND_KNOWLEDGE_LIST = 34750;
export const KIND_KNOWLEDGE_NODE = 34751;
// Essentially a markdown which is not editable
export const KIND_KNOWLEDGE_NODE_COLLECTION = 2945;

export const KIND_CONTACTLIST = 3;
export const KIND_DELETE = 5;

export const KIND_RELAY_METADATA_EVENT = 10002;

export const DEFAULT_RELAYS: Relays = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.snort.social", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
  { url: "wss://nostr.wine", read: true, write: true },
];

// eslint-disable-next-line functional/no-let
let lastPublished = 0;

export function newTimestamp(): number {
  const ts = Math.floor(Date.now() / 1000);
  const timestamp = ts > lastPublished ? ts : lastPublished + 1;
  lastPublished = timestamp;
  return timestamp;
}

export async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<void> {
  const writeRelayUrls = writeToRelays.map((r) => r.url);

  if (writeRelayUrls.length === 0) {
    throw new Error("No relays to publish on");
  }
  const results = await Promise.allSettled(
    relayPool.publish(writeRelayUrls, event)
  );
  // If one message can be sent publish is a success,
  // otherwise it's a failure
  const failures = results.filter((res) => res.status === "rejected");
  if (failures.length === writeRelayUrls.length) {
    // Reject only when all have failed
    // eslint-disable-next-line no-console
    failures.map((failure) => console.error(failure, event));
    throw new Error(
      `Failed to publish on: ${failures
        .map((failure) => failure.status)
        .join(".")}`
    );
  }
}

export function publishSettings(
  relayPool: SimplePool,
  user: KeyPair,
  settings: Settings,
  writeToRelays: Relays,
  finalizeEvent: FinalizeEvent
): Promise<void> {
  const compressedSettings: CompressedSettings = {
    b: settings.bionicReading,
    v: "v1",
    n: crypto.randomBytes(8),
  };
  const content = JSON.stringify(compressedSettings);
  const unsingedEvent = {
    kind: KIND_SETTINGS,
    pubkey: user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };
  const finalizedEvent = finalizeEvent(unsingedEvent, user.privateKey);
  return publishEvent(relayPool, finalizedEvent, writeToRelays);
}

export async function publishRelayMetadata(
  relayPool: SimplePool,
  user: KeyPair,
  relays: Relays,
  writeRelays: Relays,
  finalizeEvent: FinalizeEvent
): Promise<void> {
  const tags = relays.map((r) => {
    if (r.read && r.write) {
      return ["r", r.url];
    }
    if (r.read) {
      return ["r", r.url, "read"];
    }
    if (r.write) {
      return ["r", r.url, "write"];
    }
    return [];
  });
  const unsingedEvent = {
    kind: KIND_RELAY_METADATA_EVENT,
    pubkey: user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
  const finalizedEvent = finalizeEvent(unsingedEvent, user.privateKey);
  return publishEvent(relayPool, finalizedEvent, writeRelays);
}
