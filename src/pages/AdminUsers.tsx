import { useState } from "react";
import { useAllProfiles, useApproveUser, useSetUserRole, useUserRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Check, X, Shield, User, Clock, Mail } from "lucide-react";

export default function AdminUsers() {
  const { data: profiles, isLoading } = useAllProfiles();
  const approveUser = useApproveUser();
  const setUserRole = useSetUserRole();

  const handleApprove = async (userId: string, approve: boolean) => {
    try {
      await approveUser.mutateAsync({ userId, approved: approve });
      toast.success(approve ? "המשתמש אושר בהצלחה" : "האישור בוטל");
    } catch (error) {
      toast.error("שגיאה בעדכון המשתמש");
    }
  };

  const handleSetAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      await setUserRole.mutateAsync({ userId, role: isAdmin ? "admin" : "user" });
      toast.success(isAdmin ? "המשתמש הפך למנהל" : "הרשאות המנהל בוטלו");
    } catch (error) {
      toast.error("שגיאה בעדכון ההרשאות");
    }
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              ניהול משתמשים
            </h1>
          </div>
          <p className="text-muted-foreground">
            אשר משתמשים חדשים והגדר הרשאות
          </p>
        </div>

        {/* Users List */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : profiles && profiles.length > 0 ? (
            <div className="divide-y divide-border">
              {profiles.map((profile) => (
                <UserRow
                  key={profile.id}
                  profile={profile}
                  onApprove={handleApprove}
                  onSetAdmin={handleSetAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>אין משתמשים רשומים</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UserRowProps {
  profile: {
    id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    is_approved: boolean;
    created_at: string;
  };
  onApprove: (userId: string, approve: boolean) => void;
  onSetAdmin: (userId: string, isAdmin: boolean) => void;
}

function UserRow({ profile, onApprove, onSetAdmin }: UserRowProps) {
  const { data: role } = useUserRole(profile.user_id);
  const isAdmin = role?.role === "admin";

  return (
    <div className="p-4 lg:p-6 flex flex-col lg:flex-row lg:items-center gap-4">
      {/* User Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">
            {profile.display_name || "ללא שם"}
          </span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Shield className="h-3 w-3" />
              מנהל
            </span>
          )}
          {profile.is_approved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
              <Check className="h-3 w-3" />
              מאושר
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
              <Clock className="h-3 w-3" />
              ממתין לאישור
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            <span dir="ltr">{profile.email}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(profile.created_at).toLocaleDateString("he-IL")}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Approve/Revoke */}
        {profile.is_approved ? (
          <button
            onClick={() => onApprove(profile.user_id, false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
            בטל אישור
          </button>
        ) : (
          <button
            onClick={() => onApprove(profile.user_id, true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Check className="h-4 w-4" />
            אשר משתמש
          </button>
        )}

        {/* Admin Toggle */}
        <button
          onClick={() => onSetAdmin(profile.user_id, !isAdmin)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            isAdmin
              ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          <Shield className="h-4 w-4" />
          {isAdmin ? "הסר מנהל" : "הפוך למנהל"}
        </button>
      </div>
    </div>
  );
}