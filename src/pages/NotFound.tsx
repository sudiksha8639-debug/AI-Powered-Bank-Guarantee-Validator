import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #fef7ed 0%, #fde8d4 20%, #fef1e6 40%, #fef9ee 60%, #f0fdf4 80%, #ecfdf5 100%)" }}>
      <nav className="border-b border-black/5 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <Shield className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              BG Validator Pro
            </span>
          </button>
        </div>
      </nav>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-7xl font-bold text-foreground/10 tracking-tighter">
            404
          </p>
          <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">
            Page not found
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button
            className="mt-6 gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
