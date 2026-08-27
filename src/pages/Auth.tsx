import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { Shield, ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code is incorrect. Please check and try again.");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #fef7ed 0%, #fde8d4 20%, #fef1e6 40%, #fef9ee 60%, #f0fdf4 80%, #ecfdf5 100%)" }}>
      <nav className="border-b border-black/5 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <Shield className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              BG Validator Pro
            </span>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Card className="border-black/5 shadow-lg bg-white/70 backdrop-blur-sm">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center space-y-1 pb-2">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
                    <Shield className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl font-bold">
                    Sign in to BG Validator Pro
                  </CardTitle>
                  <CardDescription className="text-[0.85rem]">
                    Enter your email and we will send you a verification code.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@company.com"
                          type="email"
                          className="h-11 pl-9 rounded-lg"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-lg gap-2"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Continue with Email
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-3 text-sm text-destructive text-center">
                        {error}
                      </p>
                    )}
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center space-y-1 pb-2">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
                    <Shield className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl font-bold">
                    Check your inbox
                  </CardTitle>
                  <CardDescription className="text-[0.85rem]">
                    We sent a 6-digit code to
                    <br />
                    <span className="font-medium text-foreground">
                      {step.email}
                    </span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4 pt-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />
                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-3 text-sm text-destructive text-center">
                        {error}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-3 pt-0">
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-lg gap-2"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          Verify & Sign In
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>Did not receive a code?</span>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-sm"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full text-muted-foreground"
                    >
                      Use a different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>

      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 text-xs text-muted-foreground">
          <span>BG Validator Pro — Secure Document Validation</span>
        </div>
      </footer>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
