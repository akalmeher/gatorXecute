"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { AvailabilityBlock, Member } from "@/types";
import { AvailabilityGrid } from "@/features/scheduling/AvailabilityGrid";
import { formatTime } from "@/features/scheduling/scheduling-utils";
import type { AvailabilityResponse } from "@/features/ai/availability-types";
import {
  DURATIONS,
  MAX_PEOPLE,
  type MeetPerson,
  type MeetPoll,
  buildIcs,
  localTimeZone,
  recommendMeeting,
  resolveMeetingDate,
  zonedTimeToUtc,
  decodePoll,
  encodePoll,
  newPersonId,
} from "./meet-link";
import { WhereField } from "./WhereField";

/**
 * Feature Owner: Divij Anand (built on Oscar Garcia's grid and best-time logic)
 * Quick Meet: "When can we meet?" with no account and no project. Type or paint
 * your times, send the link, and the best time appears. Planning is offered
 * only afterwards, and only if the group wants it.
 */

const DAY_NAME = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8A6FF] px-5 py-3 text-sm font-semibold text-[#0F1117] hover:bg-[#B8A6FF]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1117] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-[#2A2E39] px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60 cursor-pointer transition-colors";
const quietButton =
  "inline-flex items-center rounded-lg px-2 py-1 text-sm text-[#AAA5B4] underline-offset-4 hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer";
const fieldClass =
  "w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 disabled:opacity-60";

function toMember(person: MeetPerson): Member {
  const initials = person.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return { id: person.id, name: person.name || "You", initials, skills: [], wantsToLearn: [] };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Someone";
}

function joinNames(names: string[]) {
  return names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function QuickMeetView() {
  const [poll, setPoll] = useState<MeetPoll>({ title: "", durationMinutes: 60, people: [] });
  const [fromLink, setFromLink] = useState(false);
  const [badLink, setBadLink] = useState(false);
  const [meId, setMeId] = useState<string>(() => newPersonId());
  const [myName, setMyName] = useState("");
  const [freeText, setFreeText] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [readBack, setReadBack] = useState<{ summary: string; lines: string[]; notes: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the poll from the link, and again whenever a different link is opened
  // on this page (hash changes don't reload the page). Our own edits are ignored.
  const lastWrittenHash = useRef("");
  useEffect(() => {
    const load = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === lastWrittenHash.current) return;
      const decoded = decodePoll(hash);
      setMeId(newPersonId());
      setMyName("");
      setReadBack(null);
      setCopied(false);
      if (decoded) {
        lastWrittenHash.current = hash;
        setPoll(decoded);
        setFromLink(true);
        setBadLink(false);
      } else {
        lastWrittenHash.current = hash;
        setPoll({ title: "", durationMinutes: 60, people: [] });
        setFromLink(false);
        setBadLink(true);
      }
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const me = poll.people.find((p) => p.id === meId);
  const myBlocks = useMemo(() => me?.blocks ?? [], [me]);
  const anyTimes = poll.people.some((p) => p.blocks.length > 0);
  const others = poll.people.filter((p) => p.id !== meId);
  const allBlocks = useMemo(() => poll.people.flatMap((p) => p.blocks), [poll.people]);
  const gridMembers = useMemo(() => {
    const list = poll.people.map(toMember);
    return me ? list : [...list, toMember({ id: meId, name: myName || "You", blocks: [] })];
  }, [poll.people, me, meId, myName]);

  // Everyone in the poll counts, including people with no free times yet.
  const rec = useMemo(() => recommendMeeting(poll), [poll]);
  // A "meeting" one person can attend isn't an answer.
  const best = rec && rec.attendees.length >= 2 ? rec : null;

  // Keep the address bar in sync so the current link is always the one to share.
  useEffect(() => {
    if (poll.people.length === 0 && !poll.title && !poll.where) return;
    const hash = encodePoll(poll);
    lastWrittenHash.current = hash;
    window.history.replaceState(null, "", `#${hash}`);
  }, [poll]);

  const update = (changes: Partial<MeetPoll>) => {
    setCopied(false);
    setPoll((prev) => ({ ...prev, ...changes }));
  };

  const setMyBlocks = (blocks: AvailabilityBlock[]) => {
    setCopied(false);
    setPoll((prev) => {
      const name = myName.trim() || prev.people.find((p) => p.id === meId)?.name || "You";
      const exists = prev.people.some((p) => p.id === meId);
      const people = exists
        ? prev.people.map((p) => (p.id === meId ? { ...p, name, blocks } : p))
        : [...prev.people, { id: meId, name, blocks }].slice(0, MAX_PEOPLE);
      // New times can change the best slot, so an earlier choice no longer stands.
      return { ...prev, people, chosen: undefined };
    });
  };

  const renameMe = (name: string) => {
    setMyName(name);
    setPoll((prev) => ({ ...prev, people: prev.people.map((p) => (p.id === meId ? { ...p, name: name || "You" } : p)) }));
  };

  const readMyTimes = async () => {
    if (!freeText.trim() || isReading) return;
    setIsReading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: meId, text: freeText, current: myBlocks }),
      });
      const data = (await response.json()) as AvailabilityResponse;
      if (!data.ok) {
        setAiError(data.error === "bad_request" ? data.issues?.[0] ?? data.message : data.message);
        return;
      }
      setMyBlocks(data.result.blocks);
      setReadBack({ summary: data.result.summary, lines: data.result.readBack, notes: data.result.notes });
    } catch {
      setAiError("Couldn't reach the server. You can still paint your times on the grid.");
    } finally {
      setIsReading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const downloadIcs = () => {
    if (!poll.chosen) return;
    const blob = new Blob([buildIcs(poll, poll.chosen)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(poll.title || "meeting").replace(/[^\w-]+/g, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const starter = poll.people[0];
  const confirm = () => {
    if (!best) return;
    const timeZone = localTimeZone();
    const { day, startTime, endTime } = best.slot;
    update({
      chosen: {
        day,
        startTime,
        endTime,
        timeZone,
        date: resolveMeetingDate(day, startTime, timeZone),
        attendeeIds: best.attendees.map((p) => p.id),
      },
    });
  };
  const chosenWhen = poll.chosen
    ? {
        date: new Date(`${poll.chosen.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }),
        zone:
          new Intl.DateTimeFormat("en-US", { timeZone: poll.chosen.timeZone, timeZoneName: "short" })
            .formatToParts(zonedTimeToUtc(poll.chosen.date, poll.chosen.startTime, poll.chosen.timeZone))
            .find((p) => p.type === "timeZoneName")?.value ?? poll.chosen.timeZone,
        coming: poll.people.filter((p) => poll.chosen?.attendeeIds.includes(p.id)),
        notComing: poll.people.filter((p) => !poll.chosen?.attendeeIds.includes(p.id)),
      }
    : null;

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Header: the question students already have */}
      <div className="flex items-center justify-between gap-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl sm:text-[34px] font-bold tracking-tight text-[#F5F2FA]">
          {fromLink && starter ? `${firstName(starter.name)} wants to find a time` : "When can we meet?"}
        </h1>
        <p className="text-base text-[#AAA5B4] max-w-2xl leading-relaxed">
          {fromLink && poll.title
            ? `For ${poll.title}. Add when you're free and the best time shows up.`
            : "No account, no app. Add when you're free, send the link, and the best time shows up."}
        </p>
        {!poll.chosen && (
          <div className="pt-2">
            <WhereField key={poll.where ?? ""} value={poll.where} onChange={(where) => update({ where })} />
          </div>
        )}
        {badLink && (
          <p role="alert" className="text-sm text-[#D5B45C]">
            That link looks broken, so this is a fresh start. Ask for the link again if you meant to join someone.
          </p>
        )}
      </div>
        <Image
          src="/illustrations/quick-meet.svg"
          alt=""
          width={944}
          height={880}
          unoptimized
          className="hidden sm:block w-40 h-auto shrink-0"
        />
      </div>

      {/* The answer, first */}
      {poll.chosen ? (
        <section aria-labelledby="set-heading" className="space-y-4 border-l-2 border-[#D5B45C] pl-5">
          <h2 id="set-heading" className="font-heading text-2xl font-bold text-[#F5F2FA]">
            {chosenWhen?.date} at {formatTime(poll.chosen.startTime)} is set.
          </h2>
          <p className="text-[#AAA5B4]">
            {formatTime(poll.chosen.startTime)}–{formatTime(poll.chosen.endTime)} {chosenWhen?.zone} with{" "}
            {joinNames((chosenWhen?.coming ?? []).map((p) => firstName(p.name)))}.
            {chosenWhen && chosenWhen.notComing.length > 0 && (
              <> {joinNames(chosenWhen.notComing.map((p) => firstName(p.name)))} can&apos;t make it.</>
            )}
          </p>
          <WhereField key={poll.where ?? ""} value={poll.where} onChange={(where) => update({ where })} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={downloadIcs} className={primaryButton}>
              Add to my calendar
            </button>
            <button type="button" onClick={copyLink} className={secondaryButton}>
              {copied ? "Link copied ✓" : "Copy link for the group"}
            </button>
            <button type="button" onClick={() => update({ chosen: undefined })} className={quietButton}>
              Pick a different time
            </button>
          </div>
          <p className="pt-2 text-sm text-[#AAA5B4]">
            Is this for a group project?{" "}
            <Link href="/plan" className="text-[#B8A6FF] underline-offset-4 hover:underline">
              I can help plan the work too →
            </Link>
          </p>
        </section>
      ) : best ? (
        <section aria-labelledby="best-heading" className="space-y-4 border-l-2 border-[#D5B45C] pl-5">
          <p className="text-sm font-medium text-[#D5B45C]">★ Best time</p>
          <h2 id="best-heading" className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F2FA]">
            {DAY_NAME[best.slot.day]} · {formatTime(best.slot.startTime)}–{formatTime(best.slot.endTime)}
          </h2>
          <p className="text-[#F5F2FA]/90">
            {best.everyone
              ? poll.people.length === 2
                ? "You're both free."
                : "Everyone is free."
              : [
                  `${best.attendees.length} of ${poll.people.length} can make it.`,
                  best.busy.length > 0 && `${joinNames(best.busy.map((p) => firstName(p.name)))} can't.`,
                  best.noTimes.length > 0 &&
                    `${joinNames(best.noTimes.map((p) => firstName(p.name)))} ${best.noTimes.length === 1 ? "hasn't" : "haven't"} marked any free times.`,
                ]
                  .filter(Boolean)
                  .join(" ")}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirm}
              className={primaryButton}
            >
              This works
            </button>
            <button type="button" onClick={copyLink} className={secondaryButton}>
              {copied ? "Link copied ✓" : "Copy link"}
            </button>
          </div>
        </section>
      ) : poll.people.length >= 2 && anyTimes ? (
        <section className="space-y-2 border-l-2 border-[#D5B45C] pl-5">
          <h2 className="font-heading text-2xl font-bold text-[#F5F2FA]">No time works for everyone yet.</h2>
          <p className="text-[#AAA5B4]">Try a shorter meeting, or ask people to add a few more hours.</p>
        </section>
      ) : null}

      {/* Your times */}
      <section aria-labelledby="mine-heading" className="space-y-5">
        <h2 id="mine-heading" className="font-heading text-xl font-semibold text-[#F5F2FA]">
          {me && me.blocks.length > 0 ? "Your times" : "When are you free?"}
        </h2>

        {fromLink && others.length > 0 && (
          <p className="text-sm text-[#AAA5B4]">
            Already added you?{" "}
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                className={quietButton}
                onClick={() => {
                  setMeId(p.id);
                  setMyName(p.name);
                  setReadBack(null);
                }}
              >
                I&apos;m {firstName(p.name)}
              </button>
            ))}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          {!fromLink && (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm text-[#AAA5B4]">What&apos;s it for?</span>
              <input
                value={poll.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={80}
                placeholder="Cinema presentation"
                className={fieldClass}
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-sm text-[#AAA5B4]">Your name</span>
            <input value={myName} onChange={(e) => renameMe(e.target.value)} maxLength={40} placeholder="Divij" className={fieldClass} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-[#AAA5B4]">How long?</span>
            <select
              value={poll.durationMinutes}
              onChange={(e) => update({ durationMinutes: Number(e.target.value), chosen: undefined })}
              className={`${fieldClass} cursor-pointer`}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} hour${d > 60 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void readMyTimes();
          }}
        >
          <label htmlFor="free-text" className="text-sm text-[#AAA5B4]">
            Just say it, or paste your class schedule
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="free-text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              maxLength={2000}
              disabled={isReading}
              placeholder="I'm free after 4 except Wednesdays"
              className={fieldClass}
            />
            <button type="submit" disabled={isReading || !freeText.trim()} className={`${primaryButton} shrink-0`}>
              {isReading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1117]/30 border-t-[#0F1117]" />}
              {isReading ? "Reading…" : "Fill my times"}
            </button>
          </div>
          {aiError && (
            <p role="alert" className="text-sm text-[#D5B45C]">
              {aiError}
            </p>
          )}
          {readBack && (
            <div role="status" className="space-y-1 pt-1 text-sm">
              <p className="text-[#F5F2FA]">{readBack.summary}</p>
              <p className="text-[#AAA5B4]">{readBack.lines.join(" · ")}</p>
              {readBack.notes.map((note) => (
                <p key={note} className="text-[#AAA5B4]">
                  {note}
                </p>
              ))}
              <p className="text-xs text-[#AAA5B4]">Read by Gemini. Fix anything by painting the grid below.</p>
            </div>
          )}
        </form>

        <div className="space-y-2">
          <p className="text-sm text-[#AAA5B4]">Or paint your times. Darker means more people are free.</p>
          <AvailabilityGrid
            key={meId}
            memberId={meId}
            blocks={myBlocks}
            members={gridMembers}
            allAvailability={allBlocks}
            onChange={setMyBlocks}
          />
        </div>
      </section>

      {/* Send it */}
      {!poll.chosen && !best && me && me.blocks.length > 0 && (
        <section className="space-y-2">
          <button type="button" onClick={copyLink} className={primaryButton}>
            {copied ? "Link copied ✓" : "Copy link to send"}
          </button>
          <p className="text-sm text-[#AAA5B4]">
            Send it however you like. They add their times and send it back, and the best time appears.
          </p>
        </section>
      )}

      <p className="text-xs text-[#AAA5B4]">
        Your times live inside the link, not on our servers. Typed descriptions are read by Gemini to fill the grid.
      </p>
    </div>
  );
}
