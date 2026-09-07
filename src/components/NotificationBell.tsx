import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ShoppingBag,
  Gift,
  Star,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
} from "@/lib/notifications";

type NotificationBellProps = {
  notifications: Notification[];
  unreadCount: number;

  onNotificationRead: (id: number) => void;
  onAllRead: () => void;
};

export function NotificationBell({
  notifications,
  unreadCount,
  onNotificationRead,
  onAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  async function handleNotificationClick(
    notification: Notification
  ) {
    if (notification.read) {
      return;
    }

    const success = await markNotificationAsRead(
      notification.id
    );

    if (!success) {
      return;
    }

    onNotificationRead(notification.id);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) {
      return;
    }

    const success =
      await markAllNotificationsAsRead();

    if (!success) {
      return;
    }

    onAllRead();
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {/* BOUTON CLOCHE */}

      <Button
        variant="outline"
        size="icon"
        className="relative rounded-full"
        onClick={() => setOpen((current) => !current)}
        aria-label="Notifications"
      >
        <Bell className="size-4" />

        {unreadCount > 0 && (
          <span
            className="
              absolute
              -right-1
              -top-1
              min-w-5
              h-5
              px-1
              rounded-full
              bg-rose-500
              text-white
              text-[10px]
              font-bold
              flex
              items-center
              justify-center
              ring-2
              ring-brand-cream
            "
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </Button>

      {/* MENU */}

      {open && (
        <div
          className="
            absolute
            right-0
            top-12
            z-50
            w-[340px]
            sm:w-[380px]
            max-w-[calc(100vw-2rem)]
            rounded-[22px]
            bg-card
            shadow-xl
            ring-1
            ring-border
            overflow-hidden
          "
        >
          {/* HEADER */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              p-4
              border-b
              border-border
            "
          >
            <div>
              <p className="font-semibold">
                Notifications
              </p>

              <p className="text-xs text-muted-foreground">
                {unreadCount === 0
                  ? "Aucune notification non lue"
                  : `${unreadCount} notification${
                      unreadCount > 1 ? "s" : ""
                    } non lue${
                      unreadCount > 1 ? "s" : ""
                    }`}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="
                  flex
                  items-center
                  gap-1.5
                  text-xs
                  font-medium
                  text-brand-gold
                  hover:underline
                "
              >
                <CheckCheck className="size-3.5" />

                Tout lire
              </button>
            )}
          </div>

          {/* LISTE */}

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Bell
                  className="
                    size-8
                    mx-auto
                    mb-3
                    text-muted-foreground/40
                  "
                />

                <p className="text-sm font-medium">
                  Aucune notification
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  Les nouvelles commandes et
                  récompenses apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(
                  (notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const date = new Date(
    notification.created_at
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `
        w-full
        text-left
        p-4
        flex
        gap-3
        transition
        hover:bg-muted/50
        ` +
        (!notification.read
          ? " bg-brand-gold/5"
          : "")
      }
    >
      {/* ICÔNE */}

      <div
        className="
          shrink-0
          size-9
          rounded-full
          bg-brand-warm
          flex
          items-center
          justify-center
        "
      >
        <NotificationIcon
          type={notification.type}
        />
      </div>

      {/* TEXTE */}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p
            className={
              "text-sm flex-1 " +
              (!notification.read
                ? "font-semibold"
                : "font-medium")
            }
          >
            {notification.title}
          </p>

          {!notification.read && (
            <span
              className="
                mt-1.5
                size-2
                rounded-full
                bg-brand-gold
                shrink-0
              "
            />
          )}
        </div>

        <p
          className="
            text-xs
            text-muted-foreground
            mt-1
            leading-relaxed
          "
        >
          {notification.message}
        </p>

        <p
          className="
            text-[10px]
            text-muted-foreground
            mt-2
          "
        >
          {date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
}

function NotificationIcon({
  type,
}: {
  type: Notification["type"];
}) {
  switch (type) {
    case "new_order":
      return (
        <ShoppingBag className="size-4 text-brand-gold" />
      );

    case "order_cancelled":
      return (
        <XCircle className="size-4 text-rose-500" />
      );

    case "referral_reward":
      return (
        <Gift className="size-4 text-brand-gold" />
      );

    case "loyalty_reward":
      return (
        <Star className="size-4 text-brand-gold" />
      );

    default:
      return (
        <Bell className="size-4 text-brand-gold" />
      );
  }
}