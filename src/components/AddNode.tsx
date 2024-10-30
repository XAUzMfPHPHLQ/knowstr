import React, { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import { matchPath, useLocation, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import {
  useInputElementFocus,
  CloseButton,
  NodeCard,
  LoadingSpinnerButton,
} from "citadel-commons";
import { shorten } from "../KnowledgeDataContext";
import { newNode } from "../connections";
import {
  useIsAddToNode,
  useParentNode,
  useNode,
  useViewPath,
  getParentView,
  useViewKey,
  upsertRelations,
} from "../ViewContext";
import useModal from "./useModal";
import { ESC, SearchModal } from "./SearchModal";
import { IS_MOBILE } from "./responsive";
import { Indent, useIsOpenInFullScreen } from "./Node";
import { FULL_SCREEN_PATH } from "../App";
import {
  openEditor,
  closeEditor,
  useTemporaryView,
  useIsEditorOpen,
} from "./TemporaryViewContext";
import { Plan, planUpsertNode, usePlanner } from "../planner";
import { ReactQuillWrapper } from "./ReactQuillWrapper";

function AddNodeButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}): JSX.Element {
  const isInline = useIsAddToNode() || useMediaQuery(IS_MOBILE);
  const className = isInline
    ? "add-node-button black-dimmed hover-black-dimmed"
    : "add-node-button background-transparent";
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {!isInline && <span className="simple-icon-plus me-2" />}
      <span>Add Note</span>
      <span>{}</span>
    </button>
  );
}

function SearchButton({ onClick }: { onClick: () => void }): JSX.Element {
  const [node] = useNode();
  const ariaLabel = node ? `search and attach to ${node.text}` : "search";
  return (
    <button
      className="btn btn-borderless p-0"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="simple-icon-magnifier" />
      <span className="visually-hidden">Search</span>
    </button>
  );
}

function getUrlFromText(text: string): string | undefined {
  const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*|www\.[^\s/$.?#].[^\s]*)/i;
  const match = text.match(urlRegex);
  return match ? match[0] : undefined;
}

export async function getImageUrlFromText(
  text: string
): Promise<string | undefined> {
  const url = getUrlFromText(text);
  if (!url) {
    return Promise.resolve(undefined);
  }
  /* eslint-disable functional/immutable-data */
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
  /* eslint-enable functional/immutable-data */
}

type EditorProps = {
  onCreateNode: (
    text: string,
    imageUrl?: string,
    relationType?: RelationType
  ) => void;
  onClose: () => void;
};

function Editor({ onCreateNode, onClose }: EditorProps): JSX.Element {
  const ref = React.createRef<ReactQuill>();

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, []);

  const onSave = async (relationType?: RelationType): Promise<void> => {
    if (!ref.current) {
      return;
    }
    const text = ref.current.getEditor().getText();
    const imageUrl = await getImageUrlFromText(text);
    const isNewLineAdded = text.endsWith("\n");
    onCreateNode(
      isNewLineAdded ? text.slice(0, -1) : text,
      imageUrl,
      relationType
    );
  };

  return (
    <div className="editor">
      <div className="scrolling-container pt-2 pb-2">
        <ReactQuillWrapper
          placeholder="Create a Note"
          ref={ref}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.keyCode === ESC) {
              onClose();
            }
          }}
        />
      </div>
      <div>
        <LoadingSpinnerButton onClick={() => onSave()}>
          Add Note
        </LoadingSpinnerButton>
        <CloseButton
          onClose={() => {
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function useIsFullScreen(): boolean {
  const location = useLocation();
  return matchPath(FULL_SCREEN_PATH, location.pathname) !== null;
}

function useGetFullScreenViewRepo(): string | undefined {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const repo = useNode()[0];
  return repo && id !== undefined && id === repo.id ? id : undefined;
}

type AddNodeProps = {
  onCreateNewNode: (text: string, imageUrl?: string) => void;
  onAddExistingNode: (nodeID: LongID) => void;
  ariaLabel: string;
  isSearchEnabledByShortcut?: boolean;
};

function AddNode({
  ariaLabel,
  onCreateNewNode,
  onAddExistingNode,
  isSearchEnabledByShortcut,
}: AddNodeProps): JSX.Element {
  const { openModal, closeModal, isOpen } = useModal();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const { isInputElementInFocus, setIsInputElementInFocus } =
    useInputElementFocus();
  const viewKey = useViewKey();
  const isEditorOpen = useIsEditorOpen();
  const isFullScreen = useIsFullScreen();
  const isRepoInFullScreen = useGetFullScreenViewRepo();
  // disable shortcut for SearchModal if the AddNode Element in FullScreenView is opened
  const disableSearchModal = isFullScreen && isRepoInFullScreen === undefined;
  const reset = (): void => {
    setIsInputElementInFocus(false);
    setEditorOpenState(closeEditor(editorOpenViews, viewKey));
  };
  useEffect((): (() => void) | undefined => {
    if (isSearchEnabledByShortcut && !isInputElementInFocus) {
      const handler = (event: KeyboardEvent): void => {
        if (event.key === "/" && !isOpen) {
          openModal();
        }
      };
      if (!disableSearchModal) {
        window.addEventListener("keyup", handler);
      }
      return () => {
        window.removeEventListener("keyup", handler);
        if (isOpen) {
          closeModal();
        }
      };
    }
    return undefined;
  }, [disableSearchModal, isInputElementInFocus]);

  const createNewNode = (text: string, imageUrl?: string): void => {
    onCreateNewNode(text, imageUrl);
    reset();
  };

  const onAddExistingRepo = (id: LongID): void => {
    if (isOpen) {
      closeModal();
    }
    onAddExistingNode(id);
  };

  return (
    <>
      {isOpen && (
        <SearchModal
          onAddExistingNode={onAddExistingRepo}
          onHide={closeModal}
        />
      )}
      <div className="w-100">
        {!isEditorOpen && (
          <div className="d-flex">
            <AddNodeButton
              ariaLabel={ariaLabel}
              onClick={() => {
                setEditorOpenState(openEditor(editorOpenViews, viewKey));
              }}
            />
            <div className="flex-row-end">
              <SearchButton onClick={openModal} />
            </div>
          </div>
        )}
        {isEditorOpen && (
          <Editor onCreateNode={createNewNode} onClose={reset} />
        )}
      </div>
    </>
  );
}

export function AddColumn(): JSX.Element {
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();

  const onAddNode = (plan: Plan, nodeID: LongID): void => {
    const updateRelationsPlan = upsertRelations(
      plan,
      viewPath,
      (relations) => ({
        ...relations,
        items: relations.items.push(nodeID),
      })
    );
    executePlan(updateRelationsPlan);
  };

  const onCreateNewNode = (text: string, imageUrl?: string): void => {
    const plan = createPlan();
    const node = newNode(text, plan.user.publicKey, imageUrl);
    onAddNode(planUpsertNode(plan, node), node.id);
  };

  return (
    <NodeCard className="hover-light-bg">
      <Indent levels={1} />
      <AddNode
        onCreateNewNode={onCreateNewNode}
        onAddExistingNode={(id) => onAddNode(createPlan(), id)}
        ariaLabel="add node"
        isSearchEnabledByShortcut={!isOpenInFullScreen}
      />
    </NodeCard>
  );
}

export function AddNodeToNode(): JSX.Element | null {
  const isAddToNode = useIsAddToNode();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const vContext = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const viewContext = isAddToNode ? getParentView(vContext) : vContext;
  const [node] = isAddToNode ? useParentNode() : useNode();
  if (!node || !viewContext) {
    return null;
  }

  const onAddNode = (plan: Plan, nodeID: LongID): void => {
    const updateRelationsPlan = upsertRelations(
      plan,
      viewContext,
      (relations) => ({
        ...relations,
        items: relations.items.push(nodeID),
      })
    );
    executePlan(updateRelationsPlan);
  };

  const onCreateNewNode = (text: string, imageUrl?: string): void => {
    const plan = createPlan();
    const n = newNode(text, plan.user.publicKey, imageUrl);
    onAddNode(planUpsertNode(plan, n), n.id);
  };

  return (
    <AddNode
      onCreateNewNode={onCreateNewNode}
      onAddExistingNode={(id) => onAddNode(createPlan(), id)}
      ariaLabel={`add to ${shorten(node.text)}`}
      isSearchEnabledByShortcut={isOpenInFullScreen && !isAddToNode}
    />
  );
}
