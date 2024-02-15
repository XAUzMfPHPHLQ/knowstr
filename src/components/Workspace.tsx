import React from "react";
import { List } from "immutable";

import { EmptyColumn, WorkspaceColumnView } from "./WorkspaceColumn";

import { TemporaryViewProvider } from "./TemporaryViewContext";

import { getRelations } from "../connections";
import { PushNode, useNode } from "../ViewContext";
import { DND } from "../dnd";
import { useData } from "../DataContext";

export function WorkspaceView(): JSX.Element | null {
  const [workspace, view] = useNode();
  const { knowledgeDBs, user } = useData();
  if (!workspace) {
    return null;
  }

  /* eslint-disable react/no-array-index-key */
  const relations = getRelations(
    knowledgeDBs,
    view.relations,
    user.publicKey,
    workspace.id
  );
  const columns = relations ? relations.items.toArray() : [];
  return (
    <TemporaryViewProvider>
      <div className="position-relative asset-workspace-height">
        <div className="position-absolute board overflow-y-hidden">
          <div className="workspace-columns overflow-y-hidden h-100">
            <DND>
              {columns.map((column, index) => {
                return (
                  <PushNode push={List([index])} key={index}>
                    <WorkspaceColumnView />
                  </PushNode>
                );
              })}
              <EmptyColumn />
            </DND>
          </div>
        </div>
      </div>
    </TemporaryViewProvider>
  );
  /* eslint-enable react/no-array-index-key */
}
