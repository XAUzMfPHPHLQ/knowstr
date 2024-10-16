import React from "react";
import { Map } from "immutable";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  BOB,
  createExampleProject,
  findEvent,
  findNodeByText,
  follow,
  planUpsertProjectNode,
  renderWithTestData,
  setup,
  setupTestDB,
  TEST_RELAYS,
  UpdateState,
} from "./utils.test";
import { createPlan, planPublishRelayMetadata } from "./planner";
import { execute } from "./executor";
import { NavBar } from "./components/Navbar";
import { KIND_SETTINGS, KIND_VIEWS } from "./nostr";
import { flattenRelays } from "./relays";
import { WorkspaceColumnView } from "./components/WorkspaceColumn";
import Data from "./Data";
import { LoadNode } from "./dataQuery";

test("Flatten relays", () => {
  expect(
    flattenRelays(
      Map<PublicKey, Relays>({
        [ALICE.publicKey]: [
          { url: "wss://winchester.deedsats.com/", read: true, write: true },
          { url: "wss://alice.deedsats.com/", read: true, write: true },
        ],
        [BOB.publicKey]: [
          { url: "wss://bob.deedsats.com/", read: true, write: true },
        ],
      })
    )
  ).toEqual([
    { url: "wss://winchester.deedsats.com/", read: true, write: true },
    { url: "wss://alice.deedsats.com/", read: true, write: true },
    { url: "wss://bob.deedsats.com/", read: true, write: true },
  ]);
});

async function setupTest(): Promise<{
  alice: UpdateState;
  bob: UpdateState;
  project: ProjectNode;
  workspace: KnowNode;
  bitcoin: KnowNode;
}> {
  const [alice, bob] = setup([ALICE, BOB]);
  const project = createExampleProject(alice().user.publicKey);
  await follow(alice, bob().user.publicKey);
  const planPublishRelays = planPublishRelayMetadata(createPlan(bob()), [
    { url: "wss://relay.bob.lol/", read: true, write: true },
  ]);
  await execute({
    ...bob(),
    plan: planPublishRelays,
  });
  await execute({
    ...alice(),
    plan: planUpsertProjectNode(createPlan(alice()), project),
  });
  const db = await setupTestDB(alice(), [
    ["Alice Workspace", [["Bitcoin", ["P2P", "Digital Gold"]]]],
  ]);
  const workspace = findNodeByText(db, "Alice Workspace") as KnowNode;
  const bitcoin = findNodeByText(db, "Bitcoin") as KnowNode;
  return { alice, bob, project, workspace, bitcoin };
}

test("Write Settings on user relays", async () => {
  const { alice, project } = await setupTest();
  const utils = renderWithTestData(<NavBar logout={jest.fn()} />, {
    ...alice(),
    initialRoute: `/?project=${project.id}`,
  });
  fireEvent.click(screen.getByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("switch bionic reading on"));
  const event = await findEvent(utils.relayPool, KIND_SETTINGS);
  await screen.findByLabelText("switch bionic reading off");
  expect(event?.relays).toEqual(TEST_RELAYS.map((r) => r.url));
});

test("Write views on user relays", async () => {
  const { alice, project } = await setupTest();
  const utils = renderWithTestData(
    <Data user={alice().user}>
      <LoadNode waitForEose>
        <WorkspaceColumnView />
      </LoadNode>
    </Data>,
    {
      ...alice(),
      initialRoute: `/?project=${project.id}`,
    }
  );
  utils.relayPool.resetPublishedOnRelays();
  await userEvent.click(
    await screen.findByLabelText("increase width of My first Workspace")
  );
  await findEvent(utils.relayPool, KIND_VIEWS);
  expect(utils.relayPool.getPublishedOnRelays()).toEqual(
    TEST_RELAYS.map((r) => r.url)
  );
});
