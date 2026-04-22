import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, ImagePlus, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type ChatMsg = {
  role: "user" | "assistant";
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
  preview?: string; // for displaying user image previews
};

const CHAT_URL = "/api/ai-chat";

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = async () => {
    if (!input.trim() && !pendingImage) return;
    if (loading) return;

    const userMsg: ChatMsg = pendingImage
      ? {
          role: "user",
          content: [
            { type: "text", text: input.trim() || "استخرج بيانات هذه الاستمارة" },
            { type: "image_url", image_url: { url: pendingImage } },
          ],
          preview: pendingImage,
        }
      : { role: "user", content: input.trim() };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    // Strip preview field before sending
    const apiMessages = newMessages.map(({ role, content }) => ({ role, content }));

    let assistantText = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("تم تجاوز الحد، حاول لاحقاً");
        else if (resp.status === 402) toast.error("نفد رصيد الذكاء الاصطناعي");
        else toast.error("فشل الاتصال بالمساعد");
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantText } : m
                )
              );
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("خطأ في الاتصال");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingImage(null);
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-110"
          title="مساعد ذكي"
          aria-label="مساعد ذكي"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 left-6 z-40 flex h-[600px] max-h-[85vh] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b bg-gradient-to-l from-primary/10 to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">مساعد H.A.M.D</p>
                <p className="text-[10px] text-muted-foreground">مدعوم بالذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="flex gap-1">
              {messages.length > 0 && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearChat} title="مسح المحادثة">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="space-y-3 p-3">
              {messages.length === 0 && (
                <div className="space-y-3 py-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">مرحباً 👋</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      اسألني عن أي حالة، طبيب، أو ارفع صورة استمارة لاستخراج البيانات تلقائياً.
                    </p>
                  </div>
                  <div className="space-y-1.5 px-2 text-right">
                    {[
                      "لخصلي أهم 5 نصايح لتسريع إنتاج الزيركون",
                      "إيه الفرق بين Emax و Zirconia؟",
                      "ازاي أتعامل مع تأخير حالة عاجلة؟",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="block w-full rounded-md border bg-background px-2.5 py-1.5 text-right text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60"
                    }`}
                  >
                    {m.preview && (
                      <img
                        src={m.preview}
                        alt="upload"
                        className="mb-1.5 max-h-32 rounded-lg object-cover"
                      />
                    )}
                    {typeof m.content === "string" ? (
                      m.role === "assistant" ? (
                        <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-1.5">
                          {m.content ? (
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {(m.content.find((c) => c.type === "text")?.text) || ""}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Image preview */}
          {pendingImage && (
            <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
              <img src={pendingImage} alt="preview" className="h-12 w-12 rounded object-cover" />
              <span className="flex-1 text-xs text-muted-foreground">صورة مرفقة</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPendingImage(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="border-t bg-card p-2">
            <div className="flex items-end gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImage}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                title="رفع صورة"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="اكتب رسالتك..."
                rows={1}
                className="min-h-[36px] resize-none text-sm"
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={send}
                disabled={loading || (!input.trim() && !pendingImage)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
