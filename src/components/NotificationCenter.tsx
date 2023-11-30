import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Badge } from "./Ui";
import { useInviteNotifications } from "./notifications";

/* eslint-disable react/no-array-index-key */
export function NotificationCenter(): JSX.Element | null {
  const navigate = useNavigate();
  const notifications = useInviteNotifications();

  if (notifications.size === 0) {
    return null;
  }

  return (
    <Dropdown>
      <Dropdown.Toggle
        as="button"
        id="notification-dropdown"
        key="notification-dropdown"
        className="btn"
        aria-label="notification-center"
      >
        <Badge ariaLabel="number of notifications" value={notifications.size} />
        <span className="simple-icon-bell d-block" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item
          className="d-flex workspace-selection"
          key="notification-center-item"
        >
          <div className="bold">
            <h3>Notifications</h3>
          </div>
        </Dropdown.Item>
        {notifications
          .map((notification, id) => {
            return (
              <div key={`notification-center-item ${id}`}>
                <Dropdown.Divider />
                <Dropdown.Item
                  className="d-flex workspace-selection"
                  onSelect={(): void => {
                    if (notification.navigateToLink) {
                      navigate(`${notification.navigateToLink}`);
                    }
                  }}
                >
                  <div>
                    <div className="mt-0 pr-0">
                      <span className="text-extra-small text-muted">
                        {notification.date
                          ? notification.date.toLocaleString()
                          : "Date not found"}
                      </span>
                    </div>
                    <div className="mt-1">
                      <div className="bold">{notification.title}</div>
                      <div className="mt-1">{notification.message}</div>
                    </div>
                  </div>
                </Dropdown.Item>
              </div>
            );
          })
          .valueSeq()}
      </Dropdown.Menu>
    </Dropdown>
  );
}
