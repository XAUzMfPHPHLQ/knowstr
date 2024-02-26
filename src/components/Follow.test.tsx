import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { Event, nip05, nip19 } from "nostr-tools";
import userEvent from "@testing-library/user-event";
import {
  renderWithTestData,
  renderApp,
  ALICE,
  BOB,
  BOB_PUBLIC_KEY,
  setup,
  follow,
} from "../utils.test";
import { KIND_CONTACTLIST } from "../nostr";
import { Follow } from "./Follow";

test("find a user", async () => {
  const [alice] = setup([ALICE]);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: "follow user",
  });
  const input = await screen.findByLabelText("find user");
  userEvent.type(input, BOB_PUBLIC_KEY);
  fireEvent.click(screen.getByText("Find"));

  await screen.findByLabelText("follow user");
  screen.getByDisplayValue(nip19.npubEncode(BOB_PUBLIC_KEY));
});

test("search for an invalid user", async () => {
  const [alice] = setup([ALICE]);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: "follow user",
  });
  const input = await screen.findByLabelText("find user");
  userEvent.type(input, "invalidPublicKey");
  fireEvent.click(screen.getByText("Find"));

  await screen.findByText(
    "Invalid publicKey, npub, nprofile or nip-05 identifier"
  );
});

test("search for myself leads to profile", async () => {
  const [alice] = setup([ALICE]);

  renderApp(alice());

  fireEvent.click(await screen.findByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("follow user"));

  const input = await screen.findByLabelText("find user");
  userEvent.type(input, ALICE.publicKey);
  fireEvent.click(screen.getByText("Find"));
  await screen.findByText("Your nostr npub:");
});

test("find a user by npub", async () => {
  const [alice] = setup([ALICE]);
  const npub = nip19.npubEncode(BOB_PUBLIC_KEY);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: "follow user",
  });
  const input = await screen.findByLabelText("find user");
  userEvent.type(input, npub);
  fireEvent.click(screen.getByText("Find"));

  await screen.findByLabelText("follow user");
  screen.getByDisplayValue(npub);
});

test("find a user by nprofile", async () => {
  const [alice] = setup([ALICE]);
  const nprofile = nip19.nprofileEncode({ pubkey: BOB_PUBLIC_KEY });
  const npub = nip19.npubEncode(BOB_PUBLIC_KEY);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: "follow user",
  });
  const input = await screen.findByLabelText("find user");
  userEvent.type(input, nprofile);
  fireEvent.click(screen.getByText("Find"));

  await screen.findByLabelText("follow user");
  screen.getByDisplayValue(npub);
});

test("find a user by nip-05 identifier", async () => {
  const bobsIdentifier = "bob@bobsdomain.com";
  nip05.useFetchImplementation(async () =>
    Promise.resolve({
      json: () => Promise.resolve({ names: { bob: BOB_PUBLIC_KEY } }),
    })
  );

  const [alice] = setup([ALICE]);
  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: "follow user",
  });
  const input = await screen.findByLabelText("find user");
  userEvent.type(input, bobsIdentifier);

  const findButton = screen.getByText("Find");
  await waitFor(() => {
    expect(findButton.ariaDisabled).toBe(undefined);
  });
  fireEvent.click(findButton);

  await screen.findByLabelText("follow user");
  const npub = nip19.npubEncode(BOB_PUBLIC_KEY);
  screen.getByDisplayValue(npub);
});

test("follow a new user", async () => {
  const [alice] = setup([ALICE]);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: `/follow?publicKey=${BOB_PUBLIC_KEY}`,
  });
  fireEvent.click(await screen.findByLabelText("follow user"));
  await screen.findByText("You follow this User");
});

test("unfollow an already followed user", async () => {
  const [alice] = setup([ALICE]);
  await follow(alice, BOB.publicKey);

  renderWithTestData(<Follow />, {
    ...alice(),
    initialRoute: `/follow?publicKey=${BOB_PUBLIC_KEY}`,
  });
  fireEvent.click(await screen.findByLabelText("unfollow user"));
  await screen.findByText("Follow User");
});

const filterContactListEvents = (event: Event): boolean =>
  event.kind === KIND_CONTACTLIST;

test("follow sends nip-02 event", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/follow?publicKey=${BOB_PUBLIC_KEY}`,
  });
  await waitFor(() => {
    fireEvent.click(screen.getByLabelText("follow user"));
  });

  await waitFor(() =>
    expect(relayPool.getEvents().filter(filterContactListEvents)).toHaveLength(
      1
    )
  );
  const event = relayPool.getEvents().filter(filterContactListEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 3,
      pubkey: `${ALICE.publicKey}`,
      tags: [["p", `${BOB.publicKey}`]],
      content: "",
    })
  );
});

test("unfollow sends nip-02 event", async () => {
  const [alice] = setup([ALICE]);
  await follow(alice, BOB.publicKey);

  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/follow?publicKey=${BOB_PUBLIC_KEY}`,
  });
  await waitFor(() => {
    fireEvent.click(screen.getByLabelText("unfollow user"));
  });

  await waitFor(() =>
    expect(relayPool.getEvents().filter(filterContactListEvents)).toHaveLength(
      2
    )
  );
  const event = relayPool.getEvents().filter(filterContactListEvents)[1];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 3,
      pubkey: `${ALICE.publicKey}`,
      tags: [],
      content: "",
    })
  );
});
