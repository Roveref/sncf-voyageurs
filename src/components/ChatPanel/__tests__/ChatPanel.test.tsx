import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Mock API calls
vi.mock("../../../services/api", () => ({
  chatWithAIStream: vi.fn(),
  checkAIHealth: vi.fn().mockResolvedValue({ ok: true }),
  generateSummary: vi.fn(),
  getDemoStatus: vi.fn().mockResolvedValue({ demo: false, hasData: false, provider: "ollama" }),
  getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
  hydrateChanges: vi.fn(),
  sendChatFeedback: vi.fn(),
  API_BASE: "/api",
  apiFetch: vi.fn(),
}));

// Mock stores
vi.mock("../../../stores/useThemeStore", () => ({
  useThemeStore: vi.fn((sel: any) => sel({ darkMode: false })),
}));
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: vi.fn((sel: any) => sel({ staffingNeeds: {} })),
}));
vi.mock("../../../stores/useUIStore", () => ({
  useUIStore: vi.fn((sel: any) => sel({ chatPanelOpen: false })),
}));
vi.mock("../../../stores/useScenarioStore", () => ({
  default: vi.fn((sel: any) => sel({ scenarios: [], activeScenarioId: null })),
}));

// Mock sub-components
vi.mock("../components/ChatInput", () => ({
  ChatInput: ({ value, onChange, onSubmit, disabled }: any) => (
    <div>
      <input
        aria-label="Chat message input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button onClick={onSubmit} aria-label="Send message">
        Send
      </button>
    </div>
  ),
}));
vi.mock("../components/ChatMessageBubble", () => ({
  MessageBubble: ({ message }: any) => <div data-testid="message-bubble">{message.content}</div>,
}));
vi.mock("../components/InlineChart", () => ({ InlineChart: () => null }));
vi.mock("../components/ActionChecklist", () => ({ ActionChecklist: () => null }));
vi.mock("../components/ChatMarkdown", () => ({
  ChatMarkdown: ({ content }: any) => <div>{content}</div>,
  parseStructuredBlocks: vi.fn().mockReturnValue({ text: "", actions: [], charts: [] }),
}));

// Mock hooks
vi.mock("../../../utils/restoreUserChanges", () => ({
  restoreUserChanges: vi.fn(),
}));

import ChatPanel from "../ChatPanel";

function renderChatPanel() {
  return render(
    <MemoryRouter>
      <ChatPanel />
    </MemoryRouter>
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the FAB button without crashing", () => {
    const { container } = renderChatPanel();
    expect(container.firstChild).not.toBeNull();
  });

  it("shows the FAB button initially (panel closed)", () => {
    renderChatPanel();
    // FAB should be present in the document
    const fab = document.querySelector("[class*='MuiFab']");
    expect(fab).not.toBeNull();
  });

  it("opens the panel when FAB is clicked", async () => {
    renderChatPanel();
    const fab = document.querySelector("[class*='MuiFab']") as HTMLElement;
    if (fab) await userEvent.click(fab);
    // After opening, chat input should appear
    expect(screen.queryByLabelText("Chat message input")).not.toBeNull();
  });

  it("input starts empty when panel opens", async () => {
    renderChatPanel();
    const fab = document.querySelector("[class*='MuiFab']") as HTMLElement;
    if (fab) await userEvent.click(fab);
    const input = screen.queryByLabelText("Chat message input") as HTMLInputElement | null;
    if (input) expect(input.value).toBe("");
  });

  it("renders send button when panel is open", async () => {
    renderChatPanel();
    const fab = document.querySelector("[class*='MuiFab']") as HTMLElement;
    if (fab) await userEvent.click(fab);
    expect(screen.queryByLabelText("Send message")).not.toBeNull();
  });
});
