import { Map, OrderedMap, List } from "immutable";
import { Event, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";

declare global {
  export type KeyPair = {
    privateKey: Uint8Array;
    publicKey: PublicKey;
  };

  export type Contact = {
    publicKey: PublicKey;
    mainRelay?: string;
    userName?: string;
  };

  export type ContactOfContact = Contact & {
    commonContact: PublicKey;
  };

  export type HasPublicKey = {
    publicKey: PublicKey;
  };

  type Contacts = Map<PublicKey, Contact>;

  type PublishStatus = {
    status: "rejected" | "fulfilled";
    reason?: string;
  };
  type PublishResultsOfEvent = {
    event: Event;
    results: Map<string, PublishStatus>;
  };
  type PublishResultsEventMap = Map<string, PublishResultsOfEvent>;

  type PublishEvents = {
    unsignedEvents: List<UnsignedEvent>;
    results: PublishResultsEventMap;
    isLoading: boolean;
  };

  type PublishResultsOfRelay = Map<string, Event & PublishStatus>;
  type PublishResultsRelayMap = Map<string, PublishResultsOfRelay>;

  type KnowledgeDBs = Map<PublicKey, KnowledgeData>;

  type Data = {
    contacts: Contacts;
    user: KeyPair;
    settings: Settings;
    relays: Relays;
    contactsRelays: Map<PublicKey, Relays>;
    knowledgeDBs: KnowledgeDBs;
    relaysInfos: Map<string, RelayInformation | undefined>;
    publishEventsStatus: PublishEvents;

    views: Views;
    workspaces: List<ID>;
    activeWorkspace: LongID;
    relationTypes: RelationTypes;
    contactsRelationTypes: Map<PublicKey, RelationTypes>;
    contactsWorkspaces: Map<PublicKey, List<ID>>;
  };

  type LocalStorage = {
    setLocalStorage: (key: string, value: string) => void;
    getLocalStorage: (key: string) => string | null;
    deleteLocalStorage: (key: string) => void;
  };

  type Settings = {
    bionicReading: boolean;
  };

  type CompressedSettings = {
    b: boolean; // bionicReading
    v: string;
    n: Buffer;
  };

  type CompressedSettingsFromStore = {
    b: boolean;
    v: string;
    n: string;
  };

  type Hash = string;
  type ID = string;
  type LongID = string & { readonly "": unique symbol };

  type View = {
    displaySubjects: boolean;
    relations?: LongID;
    width: number;
    // Show children, only relevant for inner nodes
    expanded?: boolean;
  };

  type Relations = {
    items: List<LongID>;
    head: ID;
    id: LongID;
    type: ID;
    updated: number;
    author: PublicKey;
  };

  type KnowNode = {
    id: LongID;
    text: string;
    author: PublicKey;
  };

  type Views = Map<string, View>;

  type Nodes = Map<ID, KnowNode>;

  type RelationType = { color: string; label: string };
  type RelationTypes = OrderedMap<ID, { color: string; label: string }>;

  type KnowledgeData = {
    nodes: Map<ID, KnowNode>;
    relations: Map<ID, Relations>;
  };
}
