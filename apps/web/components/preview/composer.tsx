"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@school2036/ui";
import { ArrowDownRight, Plus, Send } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef } from "react";
import "./composer.css";

export function Composer({
  value,
  onChange,
  onSubmit,
  suggestions = [],
  hint = "",
  placeholder = "Ask about your workspace",
  label = "Message the assistant",
  moreOptions = [],
  children,
  inline = false,
  onMinimize,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  suggestions?: string[];
  hint?: string;
  placeholder?: string;
  label?: string;
  moreOptions?: { label: string; href: string }[];
  children?: ReactNode;
  inline?: boolean;
  onMinimize?: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = value
      ? `${Math.min(160, element.scrollHeight)}px`
      : "32px";
  }, [value]);
  const submit = () => {
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <section
      aria-label="Assistant composer"
      className={`atlas-composer${inline ? " atlas-composer-inline" : ""}`}
    >
      {children}
      {!value && !children && suggestions.length > 0 && (
        <fieldset
          className="atlas-suggestions"
          aria-label="Recommended actions"
        >
          {suggestions.map((text) => (
            <button key={text} type="button" onClick={() => onSubmit(text)}>
              {text}
            </button>
          ))}
        </fieldset>
      )}
      <form
        aria-label="Workspace assistant"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={input}
          rows={1}
          aria-label={label}
          value={value}
          maxLength={2000}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="atlas-composer-footer">
          {moreOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="atlas-round-button"
                  aria-label="More options"
                >
                  <Plus size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                {moreOptions.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="atlas-composer-hint">{hint}</span>
          {onMinimize && (
            <button
              type="button"
              className="atlas-composer-minimize"
              aria-label="Minimize assistant"
              title="Minimize assistant (Esc)"
              onClick={onMinimize}
            >
              <ArrowDownRight size={18} />
            </button>
          )}
          <button
            type="submit"
            className="atlas-round-button atlas-send"
            aria-label="Send message"
            disabled={!value.trim()}
          >
            <Send size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
