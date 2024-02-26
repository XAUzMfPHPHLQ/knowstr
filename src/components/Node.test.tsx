import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { List } from "immutable";
import userEvent from "@testing-library/user-event";
import { addRelationToRelations, newNode } from "../connections";
import { DND } from "../dnd";
import {
  ALICE,
  mockFinalizeEvent,
  renderWithTestData,
  setup,
} from "../utils.test";
import { RootViewContextProvider, newRelations } from "../ViewContext";
import { Column } from "./Column";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import {
  createPlan,
  planBulkUpsertNodes,
  planUpsertNode,
  planUpsertRelations,
} from "../planner";
import { execute } from "../executor";
import { Node } from "./Node";
import { TreeView } from "./TreeView";

test("Render non existing Node", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const pl = newNode("Programming Languages", publicKey);
  const relations = addRelationToRelations(
    newRelations(pl.id, "", publicKey),
    "not-existing-id" as LongID
  );
  const plan = planUpsertRelations(
    planUpsertNode(createPlan(alice()), pl, mockFinalizeEvent),
    relations,
    mockFinalizeEvent
  );
  await execute({
    ...alice(),
    plan,
  });
  renderWithTestData(
    <RootViewContextProvider root={pl.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("Programming Languages");
  screen.getByText("Error: Node not found");
});

test("Edit node via Column Menu", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(createPlan(alice()), note, mockFinalizeEvent),
  });
  renderWithTestData(
    <RootViewContextProvider root={note.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  fireEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}edited Note{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My edited Note");
});

test("Edit node inline", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  // Connect the note with itself so it's not the root note
  // Menu doesn't show on root notes
  const plan = planUpsertRelations(
    createPlan(alice()),
    addRelationToRelations(newRelations(note.id, "", publicKey), note.id),
    mockFinalizeEvent
  );
  await execute({
    ...alice(),
    plan: planUpsertNode(plan, note, mockFinalizeEvent),
  });
  renderWithTestData(
    <RootViewContextProvider root={note.id} indices={List([0, 0])}>
      <TemporaryViewProvider>
        <DND>
          <Node />
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  fireEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}edited Note{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My edited Note");
});

test("Edited node is shown in Tree View", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const pl = newNode("Programming Languages", publicKey);
  const oop = newNode("Object Oriented Programming languages", publicKey);
  const java = newNode("Java", publicKey);

  const plan = planUpsertRelations(
    planUpsertRelations(
      createPlan(alice()),
      addRelationToRelations(newRelations(pl.id, "", publicKey), oop.id),
      mockFinalizeEvent
    ),
    addRelationToRelations(newRelations(oop.id, "", publicKey), java.id),
    mockFinalizeEvent
  );
  await execute({
    ...alice(),
    plan: planBulkUpsertNodes(plan, [pl, oop, java], mockFinalizeEvent),
  });
  renderWithTestData(
    <RootViewContextProvider root={pl.id} indices={List([0])}>
      <TemporaryViewProvider>
        <DND>
          <TreeView />
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  fireEvent.click(await screen.findByLabelText("edit Java"));
  userEvent.keyboard("{backspace}{backspace}{backspace}{backspace}C++{enter}");
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  expect(screen.queryByText("Java")).toBeNull();
  await screen.findByText("C++");
});

test("Delete node", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(createPlan(alice()), note, mockFinalizeEvent),
  });
  renderWithTestData(
    <RootViewContextProvider root={note.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  userEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.click(screen.getByLabelText("delete node"));
  expect(screen.queryByText("My Note")).toBeNull();
});
