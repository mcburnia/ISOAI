import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, AlertCircle, RotateCcw, User, Bot } from 'lucide-react';
import api from '../../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'What are the biggest compliance gaps across my active standards?',
  'Explain what ISO 42001 clause 6.1 requires in plain English.',
  'Draft an AI Risk Assessment Policy for our organisation.',
  'Which controls should I prioritise completing first and why?',
  'What evidence do I need for an ISO 27001 internal audit?',
  'Summarise our current compliance posture.',
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser ? 'bg-kmi-navy text-white' : 'bg-kmi-coral text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-kmi-navy text-white rounded-tr-sm'
            : 'bg-card border border-border text-foreground rounded-tl-sm'
        }`}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-1.5 h-1.5 bg-kmi-coral rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-kmi-coral rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-kmi-coral rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIPilot() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check if AI is configured
  useEffect(() => {
    api.get('/ai/status').then(({ data }) => setConfigured(data.configured));
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function resetConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setStreaming(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const assistantMsg: Message = { role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    // History to send (exclude the empty assistant placeholder we just added)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMsg.content, history }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Sorry, something went wrong: ${err.detail || err.error || 'Unknown error'}`,
          };
          return updated;
        });
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          try {
            const { delta, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (delta) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + delta,
                };
                return updated;
              });
            }
          } catch {
            // Malformed chunk — skip
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, the connection was interrupted. Please try again.',
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Not configured ──────────────────────────────────────────────────────

  if (configured === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">AI Pilot not configured</h2>
          <p className="text-muted-foreground max-w-md">
            Add your Anthropic API key to the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file
            and restart the backend to enable the AI Compliance Pilot.
          </p>
        </div>
        <div className="bg-muted rounded-lg px-5 py-4 text-left font-mono text-sm max-w-sm w-full">
          <p className="text-muted-foreground text-xs mb-2">Add to your .env file:</p>
          <p className="text-foreground">ANTHROPIC_API_KEY=sk-ant-...</p>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (configured === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-kmi-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-kmi-coral flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI Compliance Pilot</p>
            <p className="text-[11px] text-muted-foreground">Context-aware compliance assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={resetConversation}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-accent"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New conversation
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            {/* Welcome */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-kmi-coral/10 border border-kmi-coral/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-kmi-coral" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">AI Compliance Pilot</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask anything about your compliance programme. I have full context of your standards, control mapping, and open items.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="w-full max-w-2xl">
              <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider font-medium">
                Suggested prompts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-kmi-coral/30 transition-colors text-sm text-foreground leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-card">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about gaps, controls, policies… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kmi-coral/40 focus:border-kmi-coral disabled:opacity-50 max-h-40 overflow-y-auto leading-relaxed"
            style={{ minHeight: '48px' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="w-11 h-11 rounded-xl bg-kmi-coral text-white flex items-center justify-center flex-shrink-0 hover:bg-kmi-coral/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Responses are AI-generated. Always review before using in formal compliance documentation.
        </p>
      </div>
    </div>
  );
}
