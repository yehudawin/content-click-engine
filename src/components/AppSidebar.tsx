import { Link2, BarChart3, Settings, Menu, X, Sparkles, FolderKanban, Users, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AppSidebarProps {
  isAdmin?: boolean;
}

const baseItems = [
  { title: "יצירת קישורים", url: "/", icon: Sparkles },
  { title: "קמפיינים", url: "/campaigns", icon: FolderKanban },
  { title: "אנליטיקס", url: "/analytics", icon: BarChart3 },
  { title: "הגדרות", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "ניהול משתמשים", url: "/admin/users", icon: Users },
];

export function AppSidebar({ isAdmin = false }: AppSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const navItems = isAdmin ? [...baseItems, ...adminItems] : baseItems;

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("שגיאה בהתנתקות");
    } else {
      toast.success("התנתקת בהצלחה");
      navigate("/auth");
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground lg:hidden shadow-lg"
        aria-label="פתח תפריט"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 right-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">אחוות תורה</h1>
              <p className="text-xs text-sidebar-foreground/60">מערכת פרסומים</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          {user && (
            <div className="px-4 py-2 mb-2">
              <p className="text-xs text-sidebar-foreground/60 truncate" dir="ltr">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>התנתק</span>
          </button>
        </div>
      </aside>
    </>
  );
}