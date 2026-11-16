import { describe, expect, test } from "bun:test";
import {
  detectCommand, extractName, isNo, isUnsure, isYes, matchOption, matchServices, normalizeEmail, normalizePhone, type Option,
} from "~/nine/understand";

describe("saying no", () => {
  test.each(["no", "No.", "nope", "nah", "No thanks", "no thank you", "I'd rather not", "rather not say", "skip", "pass",
    "not interested", "I'm not interested", "never mind", "Don't send it", "nothing", "No, that's everything", "that's all", "cancel"])(
    "%p is a no", t => expect(isNo(t)).toBe(true));

  test.each(["Noah", "Nora Wanjiku", "not sure", "no idea", "I don't know", "we process invoices by hand",
    "no, we need help automating invoice processing across finance and procurement", "Nothing Ltd builds great software for banks in Kenya"])(
    "%p is not a no", t => expect(isNo(t)).toBe(false));

  test("not sure is unsure, not no", () => {
    expect(isUnsure("not sure")).toBe(true);
    expect(isUnsure("I don't know")).toBe(true);
    expect(isUnsure("no idea")).toBe(true);
    expect(isNo("not sure")).toBe(false);
  });

  test("yes", () => {
    expect(isYes("yes please")).toBe(true);
    expect(isYes("Sure, send it")).toBe(true);
    expect(isYes("no")).toBe(false);
  });
});

describe("commands that work anywhere", () => {
  test.each([
    ["start over", "restart"], ["Start again please", "restart"], ["go back", "back"], ["help", "help"], ["what can I say?", "help"],
    ["say that again", "repeat"], ["pardon", "repeat"], ["mute", "mute"], ["stop talking", "mute"], ["unmute", "unmute"],
    ["bye", "bye"], ["goodbye", "bye"], ["can I talk to a real person", "human"], ["I want to speak to someone", "human"],
    ["could someone call me back tomorrow about our ERP project", "human"],
  ] as const)("%p means %p", (t, c) => expect(detectCommand(t)).toBe(c));

  test.each(["we want help with training", "Anup", "no", "level 3", "back office automation for our finance team"])(
    "%p is not a command", t => expect(detectCommand(t)).toBeNull());
});

describe("matching answers to options", () => {
  const CONFIRM: Option[] = [["Send it to the team", "send"], ["Send it, and email me a copy", "send-copy"], ["Change something", "edit"], ["Don't send it", "nosend"]];
  test("no at the confirmation picks Don't send it", () => expect(matchOption("no", CONFIRM, false)?.[1]).toBe("nosend"));
  test("yes at the confirmation picks send", () => expect(matchOption("yes", CONFIRM, false)?.[1]).toBe("send"));
  test("words pick the closest option", () => expect(matchOption("I want to change something", CONFIRM, false)?.[1]).toBe("edit"));
  test("numbers pick by position", () => expect(matchOption("three", CONFIRM, false)?.[1]).toBe("edit"));

  const NOTES: Option[] = [["No, that's everything", "-no"]];
  test("nothing else at notes", () => expect(matchOption("nothing else", NOTES, true)?.[1]).toBe("-no"));
  const NAME: Option[] = [["I'd rather not say", "-no"]];
  test("a name doesn't match the skip option", () => expect(matchOption("Wanjiru", NAME, true)).toBeNull());
  test("rather not matches the skip option", () => expect(matchOption("I'd rather not", NAME, true)?.[1]).toBe("-no"));

  const LEVELS: Option[] = [["Level 1 · AI as a tool", "L:1"], ["Level 2 · AI as a process", "L:2"], ["Level 3 · AI as a team member", "L:3"]];
  test("level numbers", () => expect(matchOption("we're probably level two", LEVELS, false)?.[1]).toBe("L:2"));
});

describe("services from a description", () => {
  test("invoices point to automation", () => expect(matchServices("we process invoices by hand")[0].title).toBe("AI Implementation, Integration & Automation"));
  test("training points to workshops", () => expect(matchServices("upskill our staff")[0].title).toBe("AI Training, Workshops & Capacity Building"));
  test("nothing for gibberish", () => expect(matchServices("asdf qwer")).toHaveLength(0));
});

describe("names, emails, phones", () => {
  test("names", () => {
    expect(extractName("Hi, I'm jane wanjiru")).toBe("Jane Wanjiru");
    expect(extractName("my name is Otieno.")).toBe("Otieno");
    expect(extractName("jane@example.com")).toBe("");
  });
  test("emails", () => {
    expect(normalizeEmail("Jane@Example.com.")).toBe("Jane@Example.com");
    expect(normalizeEmail("jane at example dot co dot ke")).toBe("jane@example.co.ke");
    expect(normalizeEmail("jane at example")).toBeNull();
    expect(normalizeEmail("no")).toBeNull();
  });
  test("phones", () => {
    expect(normalizePhone("+254 711 223 344")).toBe("+254711223344");
    expect(normalizePhone("0711 223344")).toBe("0711223344");
    expect(normalizePhone("plus 254 711 223 344")).toBe("+254711223344");
    expect(normalizePhone("call me maybe")).toBeNull();
    expect(normalizePhone("12")).toBeNull();
  });
});
