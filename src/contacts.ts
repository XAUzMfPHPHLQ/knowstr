import { List, Map } from "immutable";
import { UnsignedEvent } from "nostr-tools";
import {
  KIND_CONTACTLIST,
  findAllTags,
  getMostRecentReplacableEvent,
} from "citadel-commons";

type FollowList = Array<Contact>;

export function parseFollowListEvent(event: UnsignedEvent): FollowList {
  const contactListTags = findAllTags(event, "p");
  if (!contactListTags) {
    return [];
  }
  return contactListTags
    .filter((tag) => tag.length >= 1)
    .map((tag) => {
      const { length } = tag;
      const publicKey = tag[0] as PublicKey;
      // we don't use mainRelay and userName, but we don't want to be a nostr client that deletes a user's data
      const mainRelay = length >= 2 ? tag[1] : undefined;
      const userName = length >= 3 ? tag[2] : undefined;
      return {
        publicKey,
        mainRelay,
        userName,
      };
    });
}

function getContactsFromFollowList(followList: FollowList): Contacts {
  return Map<PublicKey, Contact>(
    followList.map((contact) => {
      return [
        contact.publicKey,
        {
          publicKey: contact.publicKey,
        },
      ];
    })
  );
}

export function findContacts(events: List<UnsignedEvent>): Contacts {
  const contactListEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_CONTACTLIST)
  );
  if (!contactListEvent) {
    return Map<PublicKey, Contact>();
  }
  const followList = parseFollowListEvent(contactListEvent);
  return getContactsFromFollowList(followList);
}
