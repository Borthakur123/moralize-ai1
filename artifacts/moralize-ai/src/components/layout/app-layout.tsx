import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  PenTool, 
  Database, 
  ListChecks, 
  Users, 
  BarChart,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Annotate", href: "/annotate", icon: PenTool },
  { name: "Posts", href: "/posts", icon: Database },
  { name: "Annotations", href: "/annotations", icon: ListChecks },
  { name: "Coders", href: "/coders", icon: Users },
  { name: "Agreement", href: "/agreement", icon: BarChart },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const NavLinks = () => (
    <nav className="flex flex-col gap-2 p-4">
      {navigation.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href}>
            <span
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover-elevate cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-sidebar md:flex shrink-0">
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/">
            <span className="flex items-center gap-2 font-semibold text-lg cursor-pointer">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                M
              </div>
              MoralizeAI
            </span>
          </Link>
        </div>
        <ScrollArea className="flex-1">
          <NavLinks />
        </ScrollArea>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-6">
                <span className="flex items-center gap-2 font-semibold text-lg">
                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                    M
                  </div>
                  MoralizeAI
                </span>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <NavLinks />
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">MoralizeAI</span>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
