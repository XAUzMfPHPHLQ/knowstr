import React, { useState } from "react";
import "./App.css";
import {
  GroupedByAuthorFilter,
  sortEventsDescending,
  useEventQuery,
  useEventQueryByAuthor,
  useRelaysQuery,
} from "citadel-commons";
import { List, Map } from "immutable";
import { Event } from "nostr-tools";
import { DataContextProvider } from "./DataContext";
import { KnowledgeDataProvider } from "./KnowledgeDataContext";
import { findContacts } from "./contacts";
import {
  DEFAULT_RELAYS,
  KIND_KNOWLEDGE,
  KIND_KNOWLEDGE_NODE,
  KIND_REPUTATIONS,
  KIND_WORKSPACES,
} from "./nostr";
import { useApis } from "./Apis";
import {
  findNodes,
  findRelations,
  findViews,
  findWorkspaces,
} from "./knowledgeEvents";
import { DEFAULT_SETTINGS, findSettings } from "./settings";
import { newDB } from "./knowledge";
import { PlanningContextProvider, planUpdateWorkspaces } from "./planner";
import { ViewContextProvider } from "./ViewContext";

type DataProps = {
  user: KeyPair;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeData;
  contacts: Contacts;
};

function createContactsEventsQueries(): GroupedByAuthorFilter {
  return {
    kinds: [KIND_REPUTATIONS, KIND_KNOWLEDGE],
  };
}

function processEventsByAuthor(authorEvents: List<Event>): ProcessedEvents {
  const settings = findSettings(authorEvents);
  const contacts = findContacts(authorEvents);
  const nodes = findNodes(authorEvents);
  const relations = findRelations(authorEvents);
  const workspaces = findWorkspaces(authorEvents);
  const views = findViews(authorEvents);
  const knowledgeDB = {
    nodes,
    relations,
    workspaces: workspaces ? workspaces.workspaces : List<ID>(),
    activeWorkspace: workspaces
      ? workspaces.activeWorkspace
      : "my-first-workspace",
    views,
  };
  return {
    settings,
    contacts,
    knowledgeDB,
  };
}

function useEventProcessor(
  events: Map<string, Event>
): Map<PublicKey, ProcessedEvents> {
  const groupedByAuthor = events.groupBy((e) => e.pubkey as PublicKey);
  const sorted = groupedByAuthor.map((authorEvents) =>
    sortEventsDescending(List(authorEvents.valueSeq()))
  );
  return Map<PublicKey, ProcessedEvents>(
    sorted.toArray().map(([author, authorEvents]) => {
      return [author, processEventsByAuthor(authorEvents)];
    })
  );
}

function createDefaultEvents(user: KeyPair): Map<string, Event> {
  const serialized = {
    w: ["my-first-workspace"],
    a: "my-first-workspace",
  };
  const createWorkspaceNodeEvent = {
    id: "createworkspace",
    kind: KIND_KNOWLEDGE_NODE,
    pubkey: user.publicKey,
    created_at: 0,
    tags: [["d", "my-first-workspace"]],
    content: "Satoshis Workspace",
    sig: "",
  };

  const writeWorkspacesEvent = {
    id: "writeworkspaces",
    kind: KIND_WORKSPACES,
    pubkey: user.publicKey,
    created_at: 0,
    tags: [],
    content: JSON.stringify(serialized),
    sig: "",
  };
  return Map<Event<number>>({
    [createWorkspaceNodeEvent.id]: createWorkspaceNodeEvent,
    [writeWorkspacesEvent.id]: writeWorkspacesEvent,
  });
}

function Data({ user, children }: DataProps): JSX.Element {
  const myPublicKey = user.publicKey;
  const [newEvents, setNewEvents] = useState<Map<string, Event>>(Map());
  const { relayPool } = useApis();
  const { relays: myRelays } = useRelaysQuery(
    relayPool,
    [myPublicKey],
    true,
    DEFAULT_RELAYS
  );
  const relays = myRelays.length === 0 ? DEFAULT_RELAYS : myRelays;
  const readFromRelays = relays.filter((r) => r.read === true);
  const { events: sentEventsFromQuery, eose: sentEventsEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [myPublicKey],
      },
    ],
    { readFromRelays }
  );
  const sentEvents = createDefaultEvents(user).merge(
    sentEventsFromQuery.merge(newEvents)
  );
  const processedEvents = useEventProcessor(sentEvents);
  const myProcessedEvents = processedEvents.get(myPublicKey, {
    contacts: Map<PublicKey, Contact>(),
    settings: DEFAULT_SETTINGS,
    knowledgeDB: newDB(),
  });
  const contacts = myProcessedEvents.contacts.filter(
    (_, k) => k !== myPublicKey
  );
  const contactsQueryResult = useEventQueryByAuthor(
    relayPool,
    [createContactsEventsQueries()],
    contacts.keySeq().toArray(),
    { readFromRelays }
  );
  const contactsEvents = contactsQueryResult.reduce(
    (rdx, result) => rdx.merge(result.events),
    Map<string, Event>()
  );
  const contactsData = useEventProcessor(contactsEvents);
  const contactsOfContacts = contactsData.reduce((coc, data, contact) => {
    return data.contacts.reduce(
      (rdx, contactOfContact, contactOfContactKey) => {
        if (
          contacts.has(contactOfContactKey) ||
          contactOfContactKey === myPublicKey
        ) {
          return rdx;
        }
        return rdx.set(contactOfContactKey, {
          ...contactOfContact,
          commonContact: contact,
        });
      },
      coc
    );
  }, Map<PublicKey, ContactOfContact>());

  const contactsOfContactsQueryResult = useEventQueryByAuthor(
    relayPool,
    [createContactsEventsQueries()],
    contactsOfContacts.keySeq().toArray(),
    { readFromRelays }
  );
  const contactsOfContactsEvents = contactsOfContactsQueryResult.reduce(
    (rdx, result) => rdx.merge(result.events),
    Map<string, Event>()
  );
  const contactsOfContactsData = useEventProcessor(contactsOfContactsEvents);

  const contactsKnowledgeDBs = contactsData.map((data) => data.knowledgeDB);
  const contactsOfContactsKnowledgeDBs = contactsOfContactsData.map(
    (data) => data.knowledgeDB
  );

  if (!sentEventsEose) {
    return <div className="loading" aria-label="loading" />;
  }
  const myDB = processedEvents.get(myPublicKey)?.knowledgeDB || newDB();

  const knowledgeDBs = Map<PublicKey, KnowledgeData>({
    [myPublicKey]: myDB,
  })
    .merge(contactsOfContactsKnowledgeDBs)
    .merge(contactsKnowledgeDBs);

  const addNewEvents = (events: Map<string, Event>) => {
    setNewEvents((prev) => prev.merge(events));
  };

  return (
    <DataContextProvider
      contacts={processedEvents.get(myPublicKey)?.contacts || Map()}
      contactsOfContacts={contactsOfContacts}
      user={user}
      sentEvents={sentEvents.toList()}
      settings={processedEvents.get(myPublicKey)?.settings || DEFAULT_SETTINGS}
      relays={relays}
      knowledgeDBs={knowledgeDBs}
    >
      <PlanningContextProvider addNewEvents={addNewEvents}>
        <ViewContextProvider root={myDB.activeWorkspace}>
          {children}
        </ViewContextProvider>
      </PlanningContextProvider>
    </DataContextProvider>
  );
}
export default Data;
