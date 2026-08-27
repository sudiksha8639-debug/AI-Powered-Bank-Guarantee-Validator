import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Home, LogOut, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router";

export function LogoDropdown() {
  const { isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 rounded-xl border-border/60 shadow-xl">
        <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer rounded-lg text-sm">
          <Home className="mr-2 h-4 w-4" />
          Home
        </DropdownMenuItem>
        {isAuthenticated && (
          <>
            <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer rounded-lg text-sm">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer rounded-lg text-sm text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
