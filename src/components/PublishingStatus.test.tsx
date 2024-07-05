import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import {
  setup,
  ALICE,
  renderApp,
  typeNewNode,
  renderWithTestData,
  TEST_RELAYS,
} from "../utils.test";
import { PublishingStatusWrapper } from "./PublishingStatusWrapper";
import { WorkspaceView } from "./Workspace";
import { MockRelayPool, mockRelayPool } from "../nostrMock.test";

test("Publishing Status", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "New Note");
  await userEvent.click(screen.getByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  expect(await screen.findAllByText("100%")).toHaveLength(4);
  screen.getByText("Relay wss://relay.test.first.success/:");
  expect(
    screen.getAllByText("5 of the last 5 events have been published")
  ).toHaveLength(4);
});

test("Details of Publishing Status", async () => {
  const [alice] = setup([ALICE], { relays: TEST_RELAYS });
  const utils = alice();
  const view = renderWithTestData(
    <>
      <PublishingStatusWrapper />
      <WorkspaceView />
    </>,
    {
      ...utils,
      relayPool: {
        ...mockRelayPool(),
        publish: (relays: Array<string>, event: Event): Promise<string>[] => {
          if (event.kind === 34751) {
            return [
              Promise.resolve("fulfilled"),
              Promise.reject(new Error("paid relay")),
              Promise.reject(new Error("too many requests")),
              Promise.resolve("fulfilled"),
            ];
          }
          return [
            Promise.resolve("fulfilled"),
            Promise.reject(new Error("paid relay")),
            Promise.resolve("fulfilled"),
            Promise.resolve("fulfilled"),
          ];
        },
      } as unknown as MockRelayPool,
      relays: TEST_RELAYS,
    }
  );
  await typeNewNode(view, "Hello World");
  await userEvent.click(await screen.findByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  await userEvent.click(
    screen.getByText("Relay wss://relay.test.first.success/:")
  );
  screen.getByText("Relay wss://relay.test.fourth.success/:");
  expect(
    screen.getAllByText("5 of the last 5 events have been published")
  ).toHaveLength(2);

  screen.getByText("Relay wss://relay.test.third.rand/:");
  screen.getByText("3 of the last 5 events have been published");
  screen.getByText("Last rejection reason: Error: too many requests");

  screen.getByText("Relay wss://relay.test.second.fail/:");
  screen.getByText("0 of the last 5 events have been published");
  screen.getAllByText("Last rejection reason: Error: paid relay");
});
