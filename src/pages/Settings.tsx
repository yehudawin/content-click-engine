import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useChannels, useCreateChannel, useDeleteChannel } from "@/hooks/useChannels";

const PRESET_COLORS = [
  "#6366f1",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

export default function Settings() {
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelColor, setNewChannelColor] = useState(PRESET_COLORS[0]);

  const { data: channels, isLoading } = useChannels();
  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      toast.error("נא להזין שם ערוץ");
      return;
    }

    try {
      await createChannel.mutateAsync({
        name: newChannelName.trim(),
        color: newChannelColor,
      });
      toast.success("הערוץ נוסף בהצלחה!");
      setNewChannelName("");
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast.error("ערוץ זה כבר קיים");
      } else {
        toast.error("הוספת הערוץ נכשלה");
      }
    }
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}"? פעולה זו תמחק גם את כל הלינקים המשויכים.`)) {
      return;
    }

    try {
      await deleteChannel.mutateAsync(id);
      toast.success("הערוץ נמחק בהצלחה");
    } catch (error) {
      toast.error("מחיקת הערוץ נכשלה");
    }
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-2xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            הגדרות
          </h1>
          <p className="text-muted-foreground">
            ניהול ערוצי ההפצה שלכם
          </p>
        </div>

        {/* Add Channel Form */}
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            הוספת ערוץ חדש
          </h2>

          <form onSubmit={handleAddChannel} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                שם הערוץ
              </label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="לדוגמה: Instagram, LinkedIn..."
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                צבע
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewChannelColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newChannelColor === color
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={createChannel.isPending}
              className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createChannel.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              הוסף ערוץ
            </button>
          </form>
        </div>

        {/* Channels List */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              הערוצים שלכם
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : channels && channels.length > 0 ? (
            <ul className="divide-y divide-border">
              {channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="font-medium">{channel.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteChannel(channel.id, channel.name)}
                    disabled={deleteChannel.isPending}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>אין ערוצים עדיין. הוסיפו את הערוץ הראשון למעלה!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
