import React from "react";
import { List, Map } from "immutable";
import { Dropdown, Spinner, ProgressBar } from "react-bootstrap";
import { useMediaQuery } from "react-responsive";
import { Event } from "nostr-tools";
import { Button, getWriteRelays } from "citadel-commons";
import { useData } from "../DataContext";
import { IS_MOBILE } from "./responsive";
import { usePlanner } from "../planner";

function transformPublishResults(
  results: PublishResultsEventMap
): PublishResultsRelayMap {
  return results.reduce((reducer, resultsOfEvents, eventId) => {
    return resultsOfEvents.results.reduce((rdx, publishStatus, relayUrl) => {
      return rdx.set(
        relayUrl,
        (rdx.get(relayUrl) || Map<string, Event & PublishStatus>()).set(
          eventId,
          { ...resultsOfEvents.event, ...publishStatus }
        )
      );
    }, reducer);
  }, Map<string, Map<string, Event & PublishStatus>>());
}

function getStatusCount(status: PublishResultsOfRelay, type: string): number {
  return status.filter((s) => s.status === type).size;
}
function getLastRejectedReason(
  status: PublishResultsOfRelay
): string | undefined {
  const lastRejected = status
    .valueSeq()
    .reverse()
    .find((s) => s.status === "rejected");
  return lastRejected ? lastRejected.reason : undefined;
}

function getPublishingDetails(
  totalNumber: number,
  numberFulfilled: number
): string {
  if (totalNumber === 0) {
    return "No events were attempted to be published";
  }
  if (totalNumber === 1) {
    return `The last event ${
      numberFulfilled === 1 ? "has" : "has not"
    } been published`;
  }
  return `${numberFulfilled} of the last ${totalNumber} events have been published`;
}

function getWarningDetails(status: PublishResultsOfRelay): {
  percentage: number;
  isWarning: boolean;
  warningVariant: "danger" | "warning";
} {
  const numberFulfilled = getStatusCount(status, "fulfilled");
  const numberRejected = getStatusCount(status, "rejected");
  const totalNumber = numberFulfilled + numberRejected;
  const percentage = Math.round((numberFulfilled / totalNumber) * 100);
  const isWarning = percentage < 80;
  const warningVariant = percentage < 50 ? "danger" : "warning";
  return { percentage, isWarning, warningVariant };
}

function RelayPublishStatus({
  status,
  relayUrl,
}: {
  status: PublishResultsOfRelay;
  relayUrl: string;
}): JSX.Element {
  const { republishEvents } = usePlanner();
  const numberFulfilled = getStatusCount(status, "fulfilled");
  const numberRejected = getStatusCount(status, "rejected");
  const totalNumber = numberFulfilled + numberRejected;
  const publishingDetails = getPublishingDetails(totalNumber, numberFulfilled);
  const { percentage, isWarning, warningVariant } = getWarningDetails(status);
  const lastRejectedReason = getLastRejectedReason(status);
  const rejectedEvents = status
    .filter((s) => s.status === "rejected")
    .valueSeq()
    .toList() as List<Event>;
  return (
    <>
      <Dropdown.Divider />
      <Dropdown.Item
        onClick={(event) => {
          event?.stopPropagation();
        }}
      >
        <div className="flex-row-space-between">
          <div className="w-80 break-word" style={{ whiteSpace: "normal" }}>
            <div className="bold">{`Relay ${relayUrl}:`}</div>
            <ProgressBar
              now={percentage}
              label={`${percentage}%`}
              variant={isWarning ? warningVariant : "success"}
              style={{
                height: "1.5rem",
              }}
            />
            <div className="mt-1"> {publishingDetails} </div>
            {lastRejectedReason && (
              <div>{`Last rejection reason: ${lastRejectedReason}`}</div>
            )}
          </div>
          <div className="ms-2 flex-row-center align-center icon-large">
            <div className="flex-col align-center">
              <div
                className={
                  isWarning
                    ? "simple-icon-exclamation danger"
                    : "simple-icon-check success"
                }
              />
              {numberRejected > 0 && (
                <Button
                  className="btn mt-2 font-size-small"
                  ariaLabel={`resend rejected events to relay ${relayUrl}`}
                  onClick={() => republishEvents(rejectedEvents, relayUrl)}
                >
                  Resend
                </Button>
              )}
            </div>
          </div>
        </div>
      </Dropdown.Item>
    </>
  );
}

type StatusColor = "red" | "brown" | "green";

function getStatusColor(publishResults: PublishResultsRelayMap): StatusColor {
  const isDanger = publishResults.some(
    (status) =>
      getWarningDetails(status).isWarning &&
      getWarningDetails(status).warningVariant === "danger"
  );
  if (isDanger) {
    return "red";
  }
  const isWarning = publishResults.some(
    (status) => getWarningDetails(status).isWarning
  );
  if (isWarning) {
    return "brown";
  }
  return "green";
}

export function PublishingStatus(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { publishResults, loadingResults, relays } = useData();
  if (loadingResults === true) {
    return (
      <div style={{ paddingTop: "6px", paddingBottom: "4px" }}>
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  if (publishResults.size === 0) {
    return null;
  }
  const publishResultsRelayMap = transformPublishResults(publishResults);
  const writeRelays = getWriteRelays(relays);
  const publishResultsForActiveWriteRelays = publishResultsRelayMap.filter(
    (_, relayUrl) =>
      writeRelays.filter((relay) => relay.url === relayUrl).length > 0
  );
  const warningColor = getStatusColor(publishResultsForActiveWriteRelays);
  return (
    <Dropdown>
      <Dropdown.Toggle
        as="button"
        id="publishing-status-dropdown"
        key="publishing-status-dropdown"
        className="btn"
        style={{ paddingTop: "6px", paddingBottom: "4px" }}
        aria-label="publishing status"
        tabIndex={0}
      >
        <span className="simple-icon-info" style={{ color: warningColor }} />
      </Dropdown.Toggle>
      <Dropdown.Menu
        style={
          isMobile
            ? { position: "absolute", width: "100vw" }
            : { width: "30rem" }
        }
      >
        <Dropdown.Item key="publishing-status-header" className="black-muted">
          <div className="project-selection">
            <h2>Publishing Status</h2>
          </div>
        </Dropdown.Item>
        {publishResultsForActiveWriteRelays
          .map((status, relayUrl) => {
            return (
              <RelayPublishStatus
                status={status}
                relayUrl={relayUrl}
                // eslint-disable-next-line react/no-array-index-key
                key={`publishing-status ${relayUrl}`}
              />
            );
          })
          .valueSeq()}
      </Dropdown.Menu>
    </Dropdown>
  );
}
