import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, useIsApproved, useIsAdmin } from "@/hooks/useAuth";
import { Clock, ShieldAlert } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, isLoading: approvalLoading } = useIsApproved(user?.id);
  const { isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);

  const isLoading = authLoading || approvalLoading || adminLoading;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Not approved - show pending message
  if (!isApproved && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-warning/10 mb-4">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            ממתין לאישור
          </h1>
          <p className="text-muted-foreground mb-6">
            החשבון שלך נוצר בהצלחה אך טרם אושר על ידי מנהל המערכת.
            תקבל הודעה כאשר החשבון יאושר.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            רענן עמוד
          </button>
        </div>
      </div>
    );
  }

  // Require admin but not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            אין הרשאה
          </h1>
          <p className="text-muted-foreground mb-6">
            אין לך הרשאות מנהל כדי לצפות בדף זה.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            חזור לדף הבית
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}