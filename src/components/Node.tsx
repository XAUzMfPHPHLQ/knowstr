import { List } from "immutable";
import React, { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Link, matchPath, useLocation, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import { textVide } from "text-vide";
import DOMPurify from "dompurify";
import { FULL_SCREEN_PATH } from "../App";
import { getRelations } from "../connections";
import {
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  useIsAddToNode,
  getRoot,
  addNodeToPath,
  addAddToNodeToPath,
  getNodeIDFromView,
  useNodeID,
  useParentNode,
} from "../ViewContext";
import {
  NodeSelectbox,
  toggleEditing,
  useTemporaryView,
  useIsEditingOn,
  useIsParentMultiselectBtnOn,
  isMutableNode,
} from "./TemporaryViewContext";
import { IS_MOBILE } from "./responsive";
import { AddNodeToNode, getImageUrlFromText } from "./AddNode";
import { NodeMenu } from "./Menu";
import { DeleteNode } from "./DeleteNode";
import { useData } from "../DataContext";
import { planUpsertNode, usePlanner } from "../planner";
import { ReactQuillWrapper } from "./ReactQuillWrapper";
import { useNodeIsLoading } from "../LoadingStatus";
import { NodeIcon } from "./NodeIcon";
import { getRelationTypeByRelationsID } from "./RelationTypes";
import { LoadingSpinnerButton } from "../commoncomponents/LoadingSpinnerButton";
import { useInputElementFocus } from "../commoncomponents/FocusContextProvider";
import { CancelButton, NodeCard } from "../commoncomponents/Ui";

function getLevels(viewPath: ViewPath, isOpenInFullScreen: boolean): number {
  if (isOpenInFullScreen) {
    return viewPath.length - 1;
  }
  return viewPath.length - 2;
}

export function useIsOpenInFullScreen(): boolean {
  const location = useLocation();
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const viewPath = useViewPath();
  if (matchPath(FULL_SCREEN_PATH, location.pathname) === null) {
    return false;
  }
  return !!(id !== undefined && id === getRoot(viewPath).nodeID);
}

export function LoadingNode(): JSX.Element {
  return (
    <div className="ph-item">
      <div>
        <div className="ph-row">
          <div className="ph-col-12" />
          <div className="ph-col-8" />
          <div className="ph-col-12 " />
          <div className="ph-col-4" />
        </div>
      </div>
    </div>
  );
}

function ErrorContent(): JSX.Element {
  return (
    <div>
      <b>Error: Node not found</b>
      <p>The node you requested could not be found. Possible reasons are:</p>
      <ul>
        <li>You do not have permission to see this node.</li>
        <li>The node has been deleted.</li>
      </ul>
      <p>Please check your permissions and try again.</p>
    </div>
  );
}

type InlineEditorProps = {
  onCreateNode: (text: string, imageUrl?: string) => void;
  onStopEditing: () => void;
};

function InlineEditor({
  onCreateNode,
  onStopEditing,
}: InlineEditorProps): JSX.Element {
  const [node] = useNode();
  const ref = React.createRef<ReactQuill>();
  if (!node) {
    return <ErrorContent />;
  }
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      const quill = ref.current.getEditor();
      quill.deleteText(0, 1000000);
      quill.insertText(0, node.text);
    }
  }, []);
  const onSave = async (): Promise<void> => {
    if (!ref.current) {
      return;
    }
    const text = ref.current.getEditor().getText();
    const imageUrl = await getImageUrlFromText(text);
    const isNewLineAdded = text.endsWith("\n");
    onCreateNode(isNewLineAdded ? text.slice(0, -1) : text, imageUrl);
  };
  return (
    <>
      <div className="editor pb-2">
        <div className="scrolling-container flex-row-start w-100">
          <ReactQuillWrapper ref={ref} />
        </div>
      </div>
      <div className="flex-row-space-between">
        <DeleteNode
          afterOnClick={() => {
            onStopEditing();
          }}
        />
        <div className="flex-row-end">
          <LoadingSpinnerButton
            className="btn font-size-small"
            onClick={() => onSave()}
            ariaLabel="save"
          >
            <span>Save</span>
          </LoadingSpinnerButton>
          <CancelButton
            onClose={() => {
              onStopEditing();
            }}
          />
        </div>
      </div>
    </>
  );
}

function BionicText({ nodeText }: { nodeText: string }): JSX.Element {
  // need sanitizing, i.e. removing <script>-tags or onClick handles
  // otherwise dangerouslySetInnerHTML allows Cross-Site Scripting (XSS) attacks
  const sanitizedNodeText = `<span>${DOMPurify.sanitize(nodeText)}</span>`;
  const bionicNodeText = textVide(sanitizedNodeText, {
    sep: ["<b>", "</b>"],
    fixationPoint: 4,
  });
  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: bionicNodeText }} />;
}

function EditableNodeContent({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { editingViews, setEditingState } = useTemporaryView();
  const viewKey = useViewKey();
  const handleInteraction = (
    event:
      | React.KeyboardEvent<HTMLButtonElement>
      | React.MouseEvent<HTMLButtonElement>
  ): void => {
    if (
      (event instanceof KeyboardEvent && event.key === "Enter") ||
      event.type === "click"
    ) {
      setEditingState(toggleEditing(editingViews, viewKey));
    }
  };

  return (
    <button
      type="button"
      onClick={handleInteraction}
      onKeyDown={handleInteraction}
      className="node-content-button cursor-on-hover w-100"
    >
      {children}
    </button>
  );
}

function NodeContent({ node }: { node: KnowNode }): JSX.Element {
  const { settings } = useData();
  const isBionic = settings.bionicReading;
  const [isImageAccessible, setIsImageAccessible] = useState<boolean>(false);

  useEffect(() => {
    const checkImageAccessibility = async (): Promise<void> => {
      if (node.imageUrl) {
        try {
          await fetch(node.imageUrl, {
            method: "HEAD",
            mode: "no-cors",
          });
          // Since the response is opaque, we assume the image is accessible
          setIsImageAccessible(true);
        } catch {
          setIsImageAccessible(false);
          // eslint-disable-next-line no-console
          console.warn(`Invalid URL: ${node.imageUrl}`);
        }
      }
    };

    checkImageAccessibility();
  }, [node.imageUrl]);
  const textToDisplay = node.imageUrl
    ? node.text.replace(node.imageUrl, "")
    : node.text;

  return (
    <span className="break-word">
      <NodeIcon node={node} />
      {isBionic ? <BionicText nodeText={textToDisplay} /> : textToDisplay}
      {node.imageUrl && isImageAccessible && (
        <div>
          <img
            src={node.imageUrl}
            alt={node.imageUrl}
            style={{ maxWidth: "100%", height: "auto", marginTop: "10px" }}
          />
        </div>
      )}
    </span>
  );
}

function InteractiveNodeContent({
  editOnClick,
}: {
  editOnClick?: boolean;
}): JSX.Element {
  const { user } = useData();
  const [node] = useNode();
  const isLoading = useNodeIsLoading();
  if (isLoading) {
    return <LoadingNode />;
  }
  if (!node) {
    return <ErrorContent />;
  }
  if (editOnClick && isMutableNode(node, user)) {
    <EditableNodeContent>
      <NodeContent node={node} />
    </EditableNodeContent>;
  }
  return <NodeContent node={node} />;
}

function NodeAutoLink({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const [nodeID] = useNodeID();
  const isMainNodeInFullscreenView = id !== undefined && id === nodeID;
  return isMainNodeInFullscreenView ? (
    <>{children}</>
  ) : (
    <Link className="no-underline" to={`/d/${escape(nodeID)}`}>
      {children}
    </Link>
  );
}

function EditingNodeContent(): JSX.Element | null {
  const [node] = useNode();
  const { createPlan, executePlan } = usePlanner();
  const viewKey = useViewKey();
  const { editingViews, setEditingState } = useTemporaryView();
  const { setIsInputElementInFocus } = useInputElementFocus();
  if (!node) {
    return null;
  }
  const editNodeText = (text: string, imageUrl?: string): void => {
    executePlan(
      planUpsertNode(createPlan(), {
        ...node,
        text,
        imageUrl,
      })
    );
  };
  const closeEditor = (): void => {
    setIsInputElementInFocus(false);
    setEditingState(toggleEditing(editingViews, viewKey));
  };
  return (
    <InlineEditor
      onCreateNode={(text, imageUrl) => {
        editNodeText(text, imageUrl);
        closeEditor();
      }}
      onStopEditing={closeEditor}
    />
  );
}

const INDENTATION = 10;
const ARROW_WIDTH = 0;

export function Indent({ levels }: { levels: number }): JSX.Element {
  const parentView = useParentNode()[1];
  const data = useData();
  const [relationType] = parentView?.relations
    ? getRelationTypeByRelationsID(data, parentView.relations)
    : [undefined];
  const color = relationType?.color || undefined;
  const style = color
    ? {
        borderLeft: `2px solid ${color}`,
      }
    : {};
  return (
    <>
      {Array.from(Array(levels).keys()).map((k) => {
        return (
          <div key={k} style={{ marginLeft: ARROW_WIDTH }}>
            <div style={{ width: INDENTATION }} />
            {k !== 0 && (
              <div>
                <div className="vl" style={style} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function getNodesInTree(
  data: Data,
  parentPath: ViewPath,
  ctx: List<ViewPath>,
  isOpenInFullScreen?: boolean,
  noExpansion?: boolean
): List<ViewPath> {
  const [parentNodeID, parentView] = getNodeIDFromView(data, parentPath);
  const relations = getRelations(
    data.knowledgeDBs,
    parentView.relations,
    data.user.publicKey,
    parentNodeID
  );
  if (!relations) {
    return ctx;
  }
  const childPaths = relations.items.map((_, i) =>
    addNodeToPath(data, parentPath, i)
  );
  const addNodePath = addAddToNodeToPath(data, parentPath);
  const nodesInTree = childPaths.reduce(
    (nodesList: List<ViewPath>, childPath: ViewPath) => {
      const childView = getNodeIDFromView(data, childPath)[1];
      if (noExpansion) {
        return nodesList.push(childPath);
      }
      if (childView.expanded) {
        return getNodesInTree(
          data,
          childPath,
          nodesList.push(childPath),
          isOpenInFullScreen
        );
      }
      return nodesList.push(childPath);
    },
    ctx
  );
  return getLevels(parentPath, isOpenInFullScreen || false) === 0
    ? nodesInTree
    : nodesInTree.push(addNodePath);
}

export function Node({
  className,
}: {
  className?: string;
}): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const isDesktopFullScreen = !isMobile && isOpenInFullScreen;
  const levels = getLevels(viewPath, isOpenInFullScreen);
  const isDesktopFullScreenTitleNode = isDesktopFullScreen && levels === 0;
  const isAddToNode = useIsAddToNode();
  const isNodeBeingEdited = useIsEditingOn();
  const isMultiselect = useIsParentMultiselectBtnOn();
  const displayMenu = levels > 0;
  const cls = !isMobile ? `${className || ""} hover-light-bg` : className;

  return (
    <NodeCard
      className={cls}
      cardBodyClassName={
        isDesktopFullScreen ? "ps-2 pt-2 pb-0" : `ps-0 pt-4 pb-0`
      }
    >
      {levels > 0 && <Indent levels={levels} />}
      {isAddToNode && levels !== 1 && <AddNodeToNode />}
      {!isAddToNode && (
        <>
          {isMultiselect && <NodeSelectbox />}
          <div className="flex-column w-100">
            {isNodeBeingEdited && <EditingNodeContent />}
            {!isNodeBeingEdited && !isDesktopFullScreenTitleNode && (
              <NodeAutoLink>
                <InteractiveNodeContent />
              </NodeAutoLink>
            )}
            {!isNodeBeingEdited && isDesktopFullScreenTitleNode && (
              <InteractiveNodeContent editOnClick />
            )}
            {displayMenu && <NodeMenu />}
          </div>
        </>
      )}
    </NodeCard>
  );
}

export const NOTE_TYPE = "note";
