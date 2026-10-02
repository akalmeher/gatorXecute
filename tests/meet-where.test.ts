import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhere, whereForCalendar } from "@/features/meet/meet-where";

test("places keep the student's words and get a Maps link", () => {
  const w = parseWhere("J. Paul Leonard Library, SF State")!;
  assert.equal(w.kind, "place");
  assert.equal(w.label, "J. Paul Leonard Library, SF State");
  assert.match(w.mapsUrl!, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=J\.%20Paul/);
});

test("links are recognized by host, with or without https", () => {
  const cases: [string, string][] = [
    ["https://sfsu.zoom.us/j/81234567890?pwd=abc", "Zoom"],
    ["meet.google.com/abc-defg-hij", "Google Meet"],
    ["https://discord.gg/xyz123", "Discord"],
    ["https://teams.microsoft.com/l/meetup-join/123", "Microsoft Teams"],
    ["https://sfsu.webex.com/meet/divij", "Webex"],
    ["https://example.com/room", "Online"],
  ];
  for (const [input, label] of cases) {
    const w = parseWhere(input)!;
    assert.equal(w.kind, "online", input);
    assert.equal(w.label, label, input);
    assert.match(w.url!, /^https?:\/\//, input);
  }
});

test("app names without a link still count, and an ID isn't mistaken for a phone", () => {
  assert.deepEqual([parseWhere("Discord")!.kind, parseWhere("Discord")!.label], ["online", "Discord"]);
  assert.equal(parseWhere("cisco")!.label, "Webex");
  const zoom = parseWhere("Zoom 812 3456 7890")!;
  assert.equal(zoom.meetingId, "812 3456 7890");
  assert.equal(zoom.phone, undefined);
  assert.equal(whereForCalendar(zoom).location, "Zoom ID 812 3456 7890");
});

test("phone calls, with or without a number", () => {
  assert.deepEqual(parseWhere("Phone call"), { kind: "phone", label: "Phone call", phone: undefined });
  const w = parseWhere("call me at (415) 555-0123")!;
  assert.equal(w.kind, "phone");
  assert.equal(w.phone, "4155550123");
});

test("a place plus a link is hybrid", () => {
  const w = parseWhere("Library room 2 and zoom.us/j/123")!;
  assert.equal(w.kind, "hybrid");
  assert.equal(w.place, "Library room 2");
  assert.equal(w.label, "Library room 2 + Zoom");
  assert.equal(whereForCalendar(w).location, "Library room 2 · https://zoom.us/j/123");
});

test("empty or undecided means no place yet; unsafe links are never produced", () => {
  assert.equal(parseWhere(""), null);
  assert.equal(parseWhere("tbd"), null);
  const w = parseWhere("javascript:alert(1)")!;
  assert.equal(w.url, undefined);
  assert.equal(w.kind, "place");
});

test("where travels in the link and lands in the calendar file", async () => {
  const { buildIcs, decodePoll, encodePoll } = await import("@/features/meet/meet-link");
  const poll = {
    title: "Cinema presentation",
    durationMinutes: 60,
    people: [{ id: "pa", name: "Divij", blocks: [] }],
    where: "Library room 2 and zoom.us/j/123",
  };
  assert.equal(decodePoll(`#${encodePoll(poll)}`)?.where, poll.where);
  assert.equal(decodePoll(`#${encodePoll({ ...poll, where: undefined })}`)?.where, undefined);
  const ics = buildIcs(poll, {
    day: "Mon",
    date: "2026-10-05",
    startTime: "16:00",
    endTime: "17:00",
    timeZone: "America/Los_Angeles",
    attendeeIds: ["pa"],
  });
  assert.match(ics, /\r\nLOCATION:Library room 2 · https:\/\/zoom\.us\/j\/123\r\n/);
  assert.match(ics, /\r\nURL:https:\/\/zoom\.us\/j\/123\r\n/);
});
