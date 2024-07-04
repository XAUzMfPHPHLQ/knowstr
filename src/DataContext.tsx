import React from "react";
import { Map } from "immutable";
import { newDB } from "./knowledge";

export type DataContextProps = Data;

const DataContext = React.createContext<DataContextProps | undefined>(
  undefined
);

export function useData(): DataContextProps {
  const context = React.useContext(DataContext);
  if (context === undefined) {
    throw new Error("DataContext not provided");
  }
  return context;
}

export function DataContextProvider({
  children,
  ...props
}: DataContextProps & {
  children: React.ReactNode;
}): JSX.Element {
  return <DataContext.Provider value={props}>{children}</DataContext.Provider>;
}

function mergeDBNodesAndRelations(
  a: KnowledgeData | undefined,
  b: KnowledgeData | undefined
): KnowledgeData {
  const existing = a || newDB();
  if (b === undefined) {
    return existing;
  }
  return {
    nodes: existing.nodes.merge(b.nodes),
    relations: existing.relations.merge(b.relations),
  };
}

export function MergeKnowledgeDB({
  children,
  knowledgeDBs,
  relationTypes,
}: {
  children: React.ReactNode;
  knowledgeDBs: KnowledgeDBs;
  relationTypes: Map<PublicKey, RelationTypes>;
}): JSX.Element {
  const data = useData();

  const existingDBs = data.knowledgeDBs;
  const allUsers = knowledgeDBs
    .keySeq()
    .toSet()
    .union(existingDBs.keySeq().toSet());

  const mergedDBs = Map<PublicKey, KnowledgeData>(
    allUsers.toArray().map((userPK) => {
      return [
        userPK,
        mergeDBNodesAndRelations(
          existingDBs.get(userPK),
          knowledgeDBs.get(userPK)
        ),
      ];
    })
  );
  const contactsRelationTypes = relationTypes.filter(
    (_, k) => k !== data.user.publicKey
  );
  const mergedRelationTypes = data.contactsRelationTypes.merge(
    contactsRelationTypes
  );
  return (
    <DataContext.Provider
      value={{
        ...data,
        knowledgeDBs: mergedDBs,
        contactsRelationTypes: mergedRelationTypes,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
