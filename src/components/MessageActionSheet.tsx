import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reply, Copy, Pencil, Trash2, Pin, Star, X } from "lucide-react";
import { toast } from "sonner";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "🔥"];

export type MessageActionTarget = {
  id: string;
  content: string;
  sender_id: string;
  message_type?: string;
  deleted_for_everyone?: boolean;
  isMine: boolean;
};

export default function MessageActionSheet({
  open,
  target,
  onClose,
  onReply,
  onEdit,
  onPinned,
  onDeleted,
  onStarToggle,
  isStarred,
  isPinned,
  userId,
}: {
  open: boolean;
  target: MessageActionTarget | null;
  onClose: () => void;
  onReply: (m: MessageActionTarget) => void;
  onEdit: (m: MessageActionTarget) => void;
  onPinned: () => void;
  onDeleted: () => void;
  onStarToggle: () => void;
  isStarred: boolean;
  isPinned: boolean;
  userId?: string;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) setBusy(false); }, [open]);

  if (!open || !target) return null;

  const react = async (emoji: string) => {
    if (!userId) return;
    setBusy(true);
    // toggle: try delete first, otherwise insert
    const { data: existing } = await supabase
      .from("message_reactions" as any)
      .select("id")
      .eq("message_id", target.id)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from("message_reactions" as any).delete().eq("id", (existing as any).id);
    } else {
      await supabase.from("message_reactions" as any).insert({
        message_id: target.id, user_id: userId, emoji,
      } as any);
    }
    setBusy(false);
    onClose();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(target.content || ""); toast.success("Copied"); } catch {}
    onClose();
  };

  const del = async () => {
    setBusy(true);
    await supabase.from("messages").update({
      deleted_for_everyone: true,
      content: "🚫 This message was deleted",
    } as any).eq("id", target.id);
    setBusy(false);
    onDeleted();
    onClose();
  };

  const pin = async () => {
    setBusy(true);
    if (isPinned) {
      await supabase.from("message_pins" as any).delete().eq("message_id", target.id);
    } else {
      const { data: m } = await supabase.from("messages").select("conversation_id").eq("id", target.id).maybeSingle();
      if (m && userId) {
        await supabase.from("message_pins" as any).insert({
          message_id: target.id, conversation_id: (m as any).conversation_id, pinned_by: userId,
        } as any);
      }
    }
    setBusy(false);
    onPinned();
    onClose();
  };

  const canEdit = target.isMine && !target.deleted_for_everyone && (target.message_type === "text" || !target.message_type);
  const canDelete = target.isMine && !target.deleted_for_everyone;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-4 pb-8 animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* React strip */}
        <div className="flex justify-around mb-4 bg-muted/50 rounded-full py-2 px-2">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              disabled={busy}
              onClick={() => react(e)}
              className="text-2xl active:scale-125 transition-transform"
            >{e}</button>
          ))}
        </div>

        <Row icon={Reply} label="Reply" onClick={() => { onReply(target); onClose(); }} />
        <Row icon={Copy} label="Copy" onClick={copy} />
        <Row icon={Star} label={isStarred ? "Unstar" : "Star"} onClick={() => { onStarToggle(); onClose(); }} />
        <Row icon={Pin} label={isPinned ? "Unpin" : "Pin"} onClick={pin} />
        {canEdit && <Row icon={Pencil} label="Edit" onClick={() => { onEdit(target); onClose(); }} />}
        {canDelete && <Row icon={Trash2} label="Delete for everyone" danger onClick={del} />}
        <button onClick={onClose} className="w-full mt-2 h-11 rounded-full bg-muted text-sm font-medium flex items-center justify-center gap-2">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, onClick, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-muted transition-colors ${danger ? "text-destructive" : ""}`}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}
