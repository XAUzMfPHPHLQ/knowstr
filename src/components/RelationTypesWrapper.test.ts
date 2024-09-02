import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import { KIND_KNOWLEDGE_LIST, KIND_RELATION_TYPES } from "../nostr";
import { ALICE, setup, renderApp, typeNewNode } from "../utils.test";

const filterRelationTypesEvents = (event: Event): boolean =>
  event.kind === KIND_RELATION_TYPES;

const filterKnowledgeListEvents = (event: Event): boolean =>
  event.kind === KIND_KNOWLEDGE_LIST;

test("Edit Unnamed Relation Type Label", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("edit Unnamed Type"));
  await userEvent.keyboard("Named Type");
  fireEvent.click(screen.getByLabelText("save"));
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({
        "": { c: "#027d86", l: "Named Type" },
      }),
    })
  );

  cleanup();
  const view = renderApp(alice());
  await typeNewNode(view, "Hello World");
  fireEvent.click(
    await screen.findByLabelText("Add new Relations to Hello World")
  );
  await screen.findByText("Named Type");
});

test("Edit color of Unnamed Relation Type", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("edit color of Unnamed Type"));
  const newColorElement = await screen.findByTitle("#9c27b0");
  fireEvent.click(newColorElement);
  expect(screen.queryByTitle("#027d86")).toBeNull();
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({ "": { c: "#9c27b0", l: "" } }),
    })
  );
});

test("Add a new Relation Type", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("color of new relationType"));
  fireEvent.click(await screen.findByTitle("#9c27b0"));
  await userEvent.keyboard("new RelationType");
  fireEvent.click(screen.getByLabelText("save new relationType"));
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  const eventContent = JSON.parse(event.content);
  const relationTypeId =
    Object.keys(eventContent).find((key) => key !== "") || "";
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({
        "": { c: "#027d86", l: "" },
        [relationTypeId]: { c: "#9c27b0", l: "new RelationType" },
      }),
    })
  );
});

test("Add a new Relation Type to an existing Note", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "Hello World");
  fireEvent.click(
    await screen.findByLabelText("Add new Relations to Hello World")
  );
  await screen.findByLabelText("color of new relationType");
  await userEvent.keyboard("new RelationType");
  fireEvent.click(screen.getByLabelText("save new relationType"));
  await waitFor(() =>
    expect(
      view.relayPool.getEvents().filter(filterKnowledgeListEvents)
    ).toHaveLength(2)
  );
  const events = view.relayPool.getEvents().filter(filterKnowledgeListEvents);
  /* tags of upsertRelationsEvent look like this:
    [["d", shortID(relations.id)],
    ["k", shortID(relations.head)],
    ["head", relations.head],
    ["rel_type", relations.type],
    ...itemsAsTags,}
  ], */
  // two upsertRelationsEvents are expected, one at typeNewNode with default relationType one when setting the new relationType
  expect(
    events[0].tags.some((tag) => tag[0] === "rel_type" && tag[1] === "")
  ).toBeTruthy();
  expect(
    events[1].tags.some((tag) => tag[0] === "rel_type" && tag[1] !== "")
  ).toBeTruthy();
});
