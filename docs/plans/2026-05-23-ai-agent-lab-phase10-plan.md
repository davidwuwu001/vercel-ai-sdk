# Vercel AI Agent Lab - Phase 10: Advanced Features

> **Goal:** Complete the missing features identified in `docs/Vercel-SDK-待探索的功能.md` that were not fully implemented in the previous phases.

**Date:** 2026-05-23

---

## Missing Features Analysis

Based on `docs/Vercel-SDK-待探索的功能.md`, the following capabilities are not fully implemented:

| # | Feature | Priority | Complexity | Status |
|---|---------|----------|------------|--------|
| 1 | Tool Streaming UI (工具调用过程可视化) | 🔴 High | Medium | ❌ Missing |
| 2 | Voice UI (语音界面) | 🟡 Medium | High | ❌ Missing |
| 3 | Image Understanding (图片理解分析) | 🔴 High | Medium | ❌ Missing |
| 4 | MCP Client (外部工具生态) | 🟡 Medium | High | ❌ Missing |
| 5 | useObject Streaming (结构化流式UI) | 🟡 Medium | High | ❌ Missing |
| 6 | ToolLoopAgent (正式Agent封装) | 🟢 Low | High | ⚠️ Partial |

---

## Phase 10.1: Tool Streaming UI (工具调用过程可视化)

### Goal
Visualize the tool calling process in the chat UI, showing:
- Which tool is being called
- The parameters being sent
- The result being returned
- A step-by-step timeline

### Files
- Modify: `src/components/markdown-message.tsx` - Add tool call rendering
- Create: `src/components/tool-stream-panel.tsx` - Dedicated tool call visualization
- Modify: `src/app/page.tsx` - Integrate tool streaming UI

### Implementation
1. Create a `ToolCallEvent` type for streaming tool calls
2. Build a `ToolStreamPanel` component that:
   - Shows "thinking" / "calling tool" state
   - Displays tool name, parameters (formatted JSON)
   - Shows result excerpt
   - Timeline view for multiple tool calls
3. Integrate with the chat UI, replacing the current minimal tool display

### Acceptance
- User can see each tool call step-by-step
- Parameters are readable (formatted JSON)
- Results are collapsible/expandable
- Timeline shows total execution time

---

## Phase 10.2: Voice UI (语音界面)

### Goal
Add a voice input/output interface for mobile-style interaction.

### Files
- Create: `src/app/lab/voice/page.tsx` - Voice lab page
- Create: `src/lib/voice/client.ts` - Web Speech API wrapper
- Create: `src/components/voice-input-button.tsx` - Microphone button component

### Implementation
1. **Voice Input (STT)**
   - Use Web Speech API (`SpeechRecognition`) for browser-native STT
   - Fallback to `/api/media/stt` for server-side transcription
   - Push transcribed text to chat

2. **Voice Output (TTS)**
   - Use Web Speech API (`SpeechSynthesis`) for browser-native TTS
   - Option to use `/api/media/tts` for higher quality
   - Play generated audio

3. **Voice Lab UI**
   - Push-to-talk button
   - Waveform visualization (optional)
   - Voice selection dropdown
   - Language selection

### Acceptance
- User can tap microphone to speak
- Speech is transcribed and sent to chat
- AI responses can be spoken aloud
- Works on mobile browsers

---

## Phase 10.3: Image Understanding (图片理解分析)

### Goal
Enable AI to analyze uploaded images (not just generate them).

### Files
- Create: `src/lib/media/image-understanding.ts` - Image analysis provider
- Modify: `src/app/api/chat/route.ts` - Handle image attachments
- Modify: `src/lib/ai/model.ts` - Check vision capability

### Implementation
1. **Image Understanding Provider**
   - Create adapter for models with vision (Doubao, Kimi, GPT-4V, etc.)
   - Use `@ai-sdk/openai` or provider-specific vision models
   - Support base64/image URL input

2. **Chat Integration**
   - Detect image attachments in messages
   - Convert to model-specific format
   - Handle vision-capable vs non-vision models gracefully

3. **UI Enhancement**
   - Show image preview in chat
   - Indicate when AI is "looking at" the image
   - Display analysis results

### Acceptance
- User can upload image and ask "what's in this?"
- AI responds with image analysis
- Non-vision models show appropriate error

---

## Phase 10.4: MCP Client (外部工具生态)

### Goal
Enable connecting to MCP (Model Context Protocol) servers for external tools.

### Files
- Create: `src/lib/mcp/client.ts` - MCP client implementation
- Create: `src/lib/mcp/types.ts` - MCP types
- Create: `src/app/api/mcp/connect/route.ts` - MCP connection API
- Create: `src/app/lab/mcp/page.tsx` - MCP management UI

### Implementation
1. **MCP Client**
   - Implement MCP protocol (JSON-RPC over stdio)
   - Connect to local MCP servers
   - List available tools
   - Execute tool calls

2. **MCP Server Registry**
   - Store MCP server configurations in SQLite
   - Support stdio-based servers
   - Support HTTP-based servers (optional)

3. **Tool Integration**
   - Convert MCP tools to AI SDK tool format
   - Inject MCP tools into chat agent
   - Handle tool result formatting

4. **MCP Lab UI**
   - Add/remove MCP servers
   - Test individual MCP tools
   - View tool schemas

### Acceptance
- User can add an MCP server URL/command
- Available tools are listed
- Tools can be called through chat

---

## Phase 10.5: useObject Streaming (结构化流式UI)

### Goal
Implement streaming structured object generation with real-time UI updates.

### Files
- Create: `src/lib/ai/object-stream.ts` - Object streaming utilities
- Modify: `src/app/lab/structured/page.tsx` - Add streaming mode
- Create: `src/components/streaming-object-view.tsx` - Real-time object viewer

### Implementation
1. **Streaming Object Generation**
   - Use AI SDK's `streamObject` for partial results
   - Implement `useObject` hook pattern
   - Update UI incrementally as object is built

2. **Streaming Object Viewer**
   - Show object fields filling in
   - Highlight newly added/changed fields
   - Support nested object visualization
   - Real-time JSON preview

3. **Demo in Structured Lab**
   - Add "Streaming Mode" toggle
   - Compare streaming vs non-streaming output
   - Show partial object evolution

### Acceptance
- Object appears field-by-field as AI generates
- User sees "thinking" indicators per field
- Final object is identical to non-streaming version

---

## Phase 10.6: ToolLoopAgent (正式Agent封装)

### Goal
Migrate from `streamText + tools` to formal `ToolLoopAgent` pattern.

### Files
- Modify: `src/lib/agents/types.ts` - Add agent interface
- Modify: `src/lib/agents/registry.ts` - Support ToolLoopAgent
- Create: `src/lib/agents/tool-loop-agent.ts` - ToolLoopAgent implementation
- Modify: `src/app/api/agents/[id]/route.ts` - Use new agent pattern

### Implementation
1. **Agent Interface Upgrade**
   - Define `AgentConfig` with:
     - `instructions` (system prompt)
     - `tools` (tool definitions)
     - `maxSteps` (stop condition)
     - `outputSchema` (structured output)
   - Support both legacy and new patterns

2. **ToolLoopAgent Implementation**
   - Use AI SDK's `ToolLoopAgent` or custom implementation
   - Implement step-by-step execution loop
   - Track tool call history
   - Support early stopping

3. **Migration**
   - Keep existing agents working
   - Add new agents using ToolLoopAgent pattern
   - Compare behavior differences

### Acceptance
- New agents use formal ToolLoopAgent
- Existing agents still work
- Clear documentation of agent pattern differences

---

## Recommended Execution Order

```
1. Phase 10.1: Tool Streaming UI (quick win, high visibility)
2. Phase 10.2: Voice UI (medium effort)
3. Phase 10.3: Image Understanding (high business value)
4. Phase 10.4: MCP Client (advanced, future-proof)
5. Phase 10.5: useObject Streaming (nice-to-have)
6. Phase 10.6: ToolLoopAgent (refinement)
```

**Rationale:** Tool streaming gives immediate UX improvement. Voice and image understanding are core business features. MCP future-proofs the architecture. Object streaming and formal agents are refinements.

---

## Verification Checklist

After each phase:

```bash
npm run lint
npm run build
npm run dev
```

Verify:
- [ ] Feature works in isolation
- [ ] No regression in existing features
- [ ] Mobile responsiveness (for Voice)
- [ ] Error handling is graceful

---

## Dependencies

- Phase 10.1: Requires existing chat UI (`page.tsx`)
- Phase 10.2: Requires Phase 8 (Media APIs)
- Phase 10.3: Requires vision-capable model config
- Phase 10.4: Independent (can be done anytime)
- Phase 10.5: Requires Phase 10.3 (image understanding)
- Phase 10.6: Requires Phase 5 (Agent Registry)
