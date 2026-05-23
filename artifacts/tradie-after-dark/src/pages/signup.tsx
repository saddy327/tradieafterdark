import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useSignup } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Zap } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Minimum 8 characters"),
  role: z.enum(["CUSTOMER", "TRADIE"]),
  acceptedTerms: z.boolean().refine(v => v, "You must accept the terms"),
  acceptedPrivacy: z.boolean().refine(v => v, "You must accept the privacy policy"),
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultRole = params.get("role") === "TRADIE" ? "TRADIE" : "CUSTOMER";

  const { setUser } = useAuth();
  const { toast } = useToast();
  const signupMutation = useSignup();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      role: defaultRole,
      acceptedTerms: false,
      acceptedPrivacy: false,
    },
  });

  async function onSubmit(values: FormData) {
    signupMutation.mutate(
      { data: values as any },
      {
        onSuccess: (res) => {
          const data = res as any;
          setUser(data.user);
          if (data.user.role === "TRADIE") {
            setLocation("/onboarding");
          } else {
            setLocation("/");
          }
        },
        onError: (err: Error) => {
          toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Zap className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            TradieAfterDark
          </span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-1" data-testid="heading-signup">Create an account</h1>
          <p className="text-muted-foreground text-sm mb-6">Join TradieAfterDark today</p>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-muted rounded-lg" data-testid="role-toggle">
            {(["CUSTOMER", "TRADIE"] as const).map(role => (
              <button
                key={role}
                type="button"
                className={`py-2 rounded-md text-sm font-medium transition-colors ${
                  form.watch("role") === role
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => form.setValue("role", role)}
                data-testid={`button-role-${role.toLowerCase()}`}
              >
                {role === "CUSTOMER" ? "Hire a tradie" : "I'm a tradie"}
              </button>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" data-testid="input-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min. 8 characters" data-testid="input-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acceptedTerms"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal leading-snug">
                      I agree to the{" "}
                      <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acceptedPrivacy"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-privacy"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal leading-snug">
                      I agree to the{" "}
                      <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
                disabled={signupMutation.isPending}
                data-testid="button-signup-submit"
              >
                {signupMutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6" data-testid="text-login-link">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
