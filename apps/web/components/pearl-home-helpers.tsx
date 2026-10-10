"use client";

import { Button, Card } from "@school2036/ui";
import { Check, type LucideIcon } from "lucide-react";

/** The original home helper panel, shared without changing its layout or controls. */
export function PearlHomeHelpers({
  description,
  items,
  onToggle,
  onAction,
  actionLabel,
  actionDisabled = false,
}: {
  description: string;
  items: { id: string; label: string; icon: LucideIcon; enabled: boolean }[];
  onToggle: (id: string) => void;
  onAction: () => void;
  actionLabel: string;
  actionDisabled?: boolean;
}) {
  return (
    <Card className="pearl-home-more">
      <div>
        <h2>More things I can do for you</h2>
        <p>{description}</p>
      </div>
      <div className="pearl-home-helpers">
        {items.map(({ id, label, icon: Icon, enabled }) => (
          <button
            key={id}
            type="button"
            className="pearl-home-helper"
            aria-pressed={enabled}
            onClick={() => onToggle(id)}
          >
            <span className="pearl-home-helper-icon">
              <Icon />
            </span>
            <span>{label}</span>
            <span className="pearl-home-helper-tick">
              {enabled && <Check />}
            </span>
          </button>
        ))}
        <Button
          className={
            actionDisabled
              ? "pearl-home-helpers-all"
              : "pearl-home-helpers-all pearl-home-primary"
          }
          variant={actionDisabled ? "outline" : "default"}
          disabled={actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
