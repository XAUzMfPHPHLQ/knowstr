import { Set } from "immutable";
import React from "react";
import { useApis } from "../Apis";
import { deleteRelations } from "../connections";
import {
  getParentView,
  useRelationIndex,
  useViewPath,
  useViewKey,
  upsertRelations,
  updateViewPathsAfterDisconnect,
  getLast,
  useParentNode,
} from "../ViewContext";
import { switchOffMultiselect, useTemporaryView } from "./TemporaryViewContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";

export function RemoveColumnButton(): JSX.Element | null {
  const { deleteLocalStorage } = useApis().fileStore;
  const { createPlan, executePlan } = usePlanner();
  const index = useRelationIndex();
  const { multiselectBtns, selection, setState } = useTemporaryView();
  const viewKey = useViewKey();
  const viewPath = useViewPath();
  const parentViewPath = getParentView(viewPath);
  const parentView = useParentNode()[1];
  const relationsID = parentView && parentView.relations;
  if (!parentView || !relationsID || !parentViewPath || index === undefined) {
    return null;
  }

  const onClick = (): void => {
    deleteLocalStorage(viewKey);
    const updateRelationsPlan = upsertRelations(
      createPlan(),
      parentViewPath,
      (relations) => deleteRelations(relations, Set<number>([index]))
    );
    const { views } = updateRelationsPlan.knowledgeDBs.get(
      updateRelationsPlan.user.publicKey,
      newDB()
    );
    const { nodeID, nodeIndex } = getLast(viewPath);
    const updatedViews = updateViewPathsAfterDisconnect(
      views,
      nodeID,
      relationsID,
      nodeIndex
    );
    const plan = planUpdateViews(updateRelationsPlan, updatedViews);
    executePlan(plan);
    setState(switchOffMultiselect(multiselectBtns, selection, viewKey));
  };

  return (
    <button
      type="button"
      aria-label="close"
      className="outer-node-extras-close-btn close"
      onClick={onClick}
    >
      <span>×</span>
    </button>
  );
}
