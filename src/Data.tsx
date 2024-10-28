import React, { useEffect, useState } from "react";
import "./App.css";
import {
  sortEventsDescending,
  useEventQuery,
  findRelays,
  KIND_RELAY_METADATA_EVENT,
} from "citadel-commons";
import { List, Map } from "immutable";
import { Event, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";
import {
  KIND_KNOWLEDGE_NODE,
  KIND_CONTACTLIST,
  KIND_VIEWS,
  KIND_SETTINGS,
  KIND_DELETE,
  KIND_PROJECT,
  KIND_MEMBERLIST,
} from "./nostr";
import { DataContextProvider } from "./DataContext";
import { findContacts, findMembers } from "./contacts";
import { useApis } from "./Apis";
import {
  findNodes,
  findRelations,
  findViews,
  findWorkspaces,
} from "./knowledgeEvents";
import { DEFAULT_SETTINGS, findSettings } from "./settings";
import { newDB } from "./knowledge";
import { PlanningContextProvider } from "./planner";
import { useProjectContext } from "./ProjectContext";
import { WorkspaceContextProvider } from "./WorkspaceContext";
import { flattenRelays, usePreloadRelays } from "./relays";

type DataProps = {
  user: User;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeData;
  contacts: Contacts;
  relays: Relays;

  views: Views;
  workspaces: Map<ID, Workspace>;
  projectMembers: Members;
};

export function newProcessedEvents(): ProcessedEvents {
  return {
    settings: DEFAULT_SETTINGS,
    knowledgeDB: newDB(),
    contacts: Map<PublicKey, Contact>(),
    relays: [],
    views: Map<string, View>(),
    workspaces: Map<ID, Workspace>(),
    projectMembers: Map<PublicKey, Member>(),
  };
}

export const KIND_SEARCH = [KIND_KNOWLEDGE_NODE, KIND_DELETE, KIND_PROJECT];

export const KINDS_META = [KIND_SETTINGS, KIND_CONTACTLIST, KIND_VIEWS];

function mergeEvents(
  processed: ProcessedEvents,
  events: List<UnsignedEvent | Event>
): ProcessedEvents {
  return {
    ...processed,
    contacts: processed.contacts.merge(findContacts(events)),
    views: findViews(events).merge(processed.views),
  };
}

function processEventsByAuthor(
  authorEvents: List<UnsignedEvent | Event>
): ProcessedEvents {
  const settings = findSettings(authorEvents);
  const contacts = findContacts(authorEvents);
  const nodes = findNodes(authorEvents);
  const relations = findRelations(authorEvents);
  const workspaces = findWorkspaces(authorEvents);
  const views = findViews(authorEvents);
  const projectMembers = findMembers(authorEvents);
  const knowledgeDB = {
    nodes,
    relations,
  };
  const relays = findRelays(authorEvents);
  return {
    settings,
    contacts,
    knowledgeDB,
    relays,
    views,
    workspaces,
    projectMembers,
  };
}

export function processEvents(
  events: List<UnsignedEvent>
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

export function useRelaysInfo(
  relays: Array<Relay>,
  eose: boolean
): Map<string, RelayInformation | undefined> {
  const { nip11 } = useApis();
  const [infos, setInfos] = useState<Map<string, RelayInformation | undefined>>(
    Map<string, RelayInformation | undefined>()
  );
  useEffect(() => {
    if (!eose) {
      return;
    }

    (async () => {
      const fetchedInfos = await Promise.all(
        relays.map(
          async (relay): Promise<[string, RelayInformation | undefined]> => {
            try {
              const info = await nip11.fetchRelayInformation(relay.url);
              return [relay.url, info];
            } catch {
              return [relay.url, undefined];
            }
          }
        )
      );
      setInfos(Map(fetchedInfos));
    })();
  }, [JSON.stringify(relays.map((r) => r.url)), eose]);
  return infos;
}

function Data({ user, children }: DataProps): JSX.Element {
  const myPublicKey = user.publicKey;
  const [newEventsAndPublishResults, setNewEventsAndPublishResults] =
    useState<EventState>({
      unsignedEvents: List(),
      results: Map(),
      isLoading: false,
      preLoginEvents: List(),
    });
  const { isRelaysLoaded } = useProjectContext();
  const { relayPool } = useApis();

  const { events: mE, eose: metaEventsEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [myPublicKey],
        kinds: [KIND_SETTINGS, KIND_CONTACTLIST, KIND_VIEWS],
      },
    ],
    {
      readFromRelays: usePreloadRelays({
        user: true,
      }),
    }
  );
  const metaEvents = mE
    .valueSeq()
    .toList()
    .merge(newEventsAndPublishResults.unsignedEvents);

  const processedMetaEvents = mergeEvents(
    processEvents(metaEvents).get(myPublicKey, newProcessedEvents()),
    newEventsAndPublishResults.preLoginEvents
  );
  const contacts = processedMetaEvents.contacts.filter(
    (_, k) => k !== myPublicKey
  );

  const { events: contactRelayEvents } = useEventQuery(
    relayPool,
    [
      {
        authors: contacts.keySeq().toArray(),
        kinds: [KIND_RELAY_METADATA_EVENT],
      },
    ],
    {
      readFromRelays: usePreloadRelays({
        defaultRelays: true,
        user: true,
        project: true,
      }),
      enabled: metaEventsEose,
    }
  );

  const processedContactRelayEvents = processEvents(
    contactRelayEvents.valueSeq().toList()
  );

  const contactsRelays = processedContactRelayEvents.reduce((rdx, p, key) => {
    return rdx.set(key, p.relays);
  }, Map<PublicKey, Relays>());
  const searchRelaysInfo = useRelaysInfo(
    [
      ...usePreloadRelays({
        defaultRelays: false,
        user: true,
        project: true,
      }),
      ...flattenRelays(contactsRelays),
    ],
    isRelaysLoaded
  );

  const { project } = useProjectContext();

  // Load Projects members
  const { events: membersEvents } = useEventQuery(
    relayPool,
    [
      {
        authors: project ? [project.memberListProvider] : [],
        kinds: [KIND_MEMBERLIST],
      },
    ],
    {
      enabled: !!project,
      readFromRelays: usePreloadRelays({
        user: true,
        project: true,
      }),
    }
  );
  const processedEvents = project?.memberListProvider
    ? processEvents(membersEvents.valueSeq().toList()).get(
        project.memberListProvider,
        newProcessedEvents()
      )
    : newProcessedEvents();
  const projectMembers =
    processedEvents.projectMembers || Map<PublicKey, Member>();

  return (
    <DataContextProvider
      contacts={contacts}
      user={user}
      settings={processedMetaEvents.settings}
      contactsRelays={contactsRelays}
      knowledgeDBs={Map<PublicKey, KnowledgeData>()}
      relaysInfos={searchRelaysInfo}
      publishEventsStatus={newEventsAndPublishResults}
      views={processedMetaEvents.views}
      projectMembers={projectMembers}
    >
      <WorkspaceContextProvider>
        <PlanningContextProvider
          setPublishEvents={setNewEventsAndPublishResults}
        >
          {children}
        </PlanningContextProvider>
      </WorkspaceContextProvider>
    </DataContextProvider>
  );
}
export default Data;
