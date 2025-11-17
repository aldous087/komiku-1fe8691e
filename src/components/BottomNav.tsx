import { Home, Library, Bookmark, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

export const BottomNav = () => {
  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/library", icon: Library, label: "Daftar" },
    { to: "/bookmarks", icon: Bookmark, label: "Bookmark" },
    { to: "/profile", icon: User, label: "Profil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-smooth flex-1"
            activeClassName="text-primary bg-primary/10"
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
