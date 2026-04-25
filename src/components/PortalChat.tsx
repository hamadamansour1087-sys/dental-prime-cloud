import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send, Loader2, FileText, Image as ImageIcon, X } from "lucide-react";
import { Paperclip, Send, Loader2, FileText, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

interface PortalMessage {
  id: string;
  lab_id: string;
  doctor_id: string;
  case_id: string | null;
  sender_type: "doctor" | "lab";
  sender_user_id: string | null;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  read_by_lab: boolean;
  read_by_doctor: boolean;
  created_at: string;
}

interface Props {
  labId: string;
  doctorId: string;
  caseId?: string | null; // null/undefined = general thread
  viewer: "doctor" | "lab";
  currentUserId?: string | null;
  className?: string;
}

export function PortalChat({ labId, doctorId, caseId, viewer, currentUserId, className }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  const queryKey = ["portal-messages", labId, doctorId, caseId ?? "general"] as const;

  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("portal_messages")
        .select("*")
        .eq("lab_id", labId)
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (caseId) q = q.eq("case_id", caseId);
      else q = q.is("case_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PortalMessage[];
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark as read when viewing
  useEffect(() => {
    if (!messages.length) return;
    const unread = messages.filter((m) =>
      viewer === "lab" ? !m.read_by_lab && m.sender_type === "doctor" : !m.read_by_doctor && m.sender_type === "lab"
    );
    if (!unread.length) return;
    const ids = unread.map((m) => m.id);
    const patch = viewer === "lab" ? { read_by_lab: true } : { read_by_doctor: true };
    supabase.from("portal_messages").update(patch).in("id", ids).then(() => {
      qc.invalidateQueries({ queryKey: ["portal-unread"] });
    });
  }, [messages, viewer, qc]);

  // Realtime subscription
  useEffect(() => {
    const filter = caseId
      ? `case_id=eq.${caseId}`
      : `doctor_id=eq.${doctorId}`;
    const channel = supabase
      .channel(`portal-chat-${labId}-${doctorId}-${caseId ?? "general"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_messages", filter },
        (payload) => {
          const msg = payload.new as PortalMessage;
          // Only handle messages for this thread
          if (msg.lab_id !== labId || msg.doctor_id !== doctorId) return;
          if ((caseId ?? null) !== (msg.case_id ?? null)) return;
          // Sound only if from the other side and not already seen
          const fromOther = (viewer === "lab" && msg.sender_type === "doctor") || (viewer === "doctor" && msg.sender_type === "lab");
          if (fromOther && lastSeenRef.current !== msg.id) {
            lastSeenRef.current = msg.id;
            playNotificationSound({ freq: 660 });
          }
          qc.invalidateQueries({ queryKey });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, doctorId, caseId, viewer, qc, queryKey]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let attachment_path: string | null = null;
      let attachment_name: string | null = null;
      let attachment_mime: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${labId}/${doctorId}/${caseId ?? "general"}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("portal-chat").upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) throw upErr;
        attachment_path = path;
        attachment_name = file.name;
        attachment_mime = file.type || null;
      }
      const { error } = await supabase.from("portal_messages").insert({
        lab_id: labId,
        doctor_id: doctorId,
        case_id: caseId ?? null,
        sender_type: viewer,
        sender_user_id: currentUserId ?? null,
        body: text.trim() || null,
        attachment_path,
        attachment_name,
        attachment_mime,
        read_by_lab: viewer === "lab",
        read_by_doctor: viewer === "doctor",
      });
      if (error) throw error;
      setText("");
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-[400px] ${className ?? ""}`} dir="rtl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-md border bg-muted/20">
        <div className="space-y-2 p-3">
          {messages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              لا توجد رسائل بعد — ابدأ المحادثة
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_type === viewer;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card border"
                  }`}
                >
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.attachment_path && (
                    <AttachmentPreview path={m.attachment_path} name={m.attachment_name ?? "ملف"} mime={m.attachment_mime} />
                  )}
                  <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {file && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="truncate flex items-center gap-1.5">
            {file.type.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {file.name}
          </span>
          <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFile(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <label className="inline-flex shrink-0">
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" size="icon" asChild>
            <span><Paperclip className="h-4 w-4" /></span>
          </Button>
        </label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="button" onClick={send} disabled={sending || (!text.trim() && !file)}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function AttachmentPreview({ path, name, mime }: { path: string; name: string; mime: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("portal-chat")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const isImage = (mime ?? "").startsWith("image/");
  if (!url) {
    return <p className="mt-1 text-xs opacity-70">جارٍ تحميل المرفق...</p>;
  }
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={url} alt={name} className="max-h-48 rounded-md" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-background/30 px-2 py-1 text-xs underline"
    >
      <FileText className="h-3.5 w-3.5" />
      {name}
    </a>
  );
}
