import { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitIdentity, useSubmitTradeInfo, useSubmitAvailability, useSubmitLicence, useSubmitInsurance, useCreateCheckoutSession } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Zap, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";

const STEPS = ["Identity", "Trade Info", "Availability", "Licence", "Insurance", "Payment"];

const AUS_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "ACT", "NT"];
const TRADES = ["Electrician", "Plumber", "Builder", "Carpenter", "Painter", "Tiler", "Roofer", "Landscaper", "Concreter", "Handyman", "Air Conditioning & Refrigeration", "Locksmith", "Pest Control", "Cleaner"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  const submitIdentity = useSubmitIdentity();
  const submitTrade = useSubmitTradeInfo();
  const submitAvailability = useSubmitAvailability();
  const submitLicence = useSubmitLicence();
  const submitInsurance = useSubmitInsurance();
  const createCheckout = useCreateCheckoutSession();

  const identityForm = useForm({ defaultValues: { legalName: "", dob: "", mobile: "", homeSuburb: "", homeState: "QLD", abn: "" } });
  const tradeForm = useForm({ defaultValues: { displayName: "", bio: "", trades: [] as string[], servicePostcodes: [] as string[], hourlyRate: 80, yearsExp: 1, postcodesText: "" } });
  const availForm = useForm({ defaultValues: { availableEvenings: false, availableWeekends: false, availableDayMask: 0 } });
  const licenceForm = useForm({ defaultValues: { trade: "", issuingState: "QLD", licenceNumber: "", licenceClass: "", isSelfDeclared: false } });
  const insuranceForm = useForm({ defaultValues: { optedOut: false, insurer: "", policyNumber: "" } });

  async function doIdentity(vals: any) {
    submitIdentity.mutate(
      { data: vals },
      { onSuccess: () => setStep(1), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) },
    );
  }

  async function doTrade(vals: any) {
    const servicePostcodes = (vals.postcodesText as string).split(/[\s,]+/).filter(Boolean);
    const tradeVals = [vals.selectedTrade].filter(Boolean);
    submitTrade.mutate(
      { data: { displayName: vals.displayName, bio: vals.bio, trades: tradeVals, servicePostcodes, hourlyRate: Number(vals.hourlyRate), yearsExp: Number(vals.yearsExp) } as any },
      { onSuccess: () => setStep(2), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) },
    );
  }

  async function doAvailability(vals: any) {
    submitAvailability.mutate(
      { data: { availableEvenings: vals.availableEvenings, availableWeekends: vals.availableWeekends, availableDayMask: vals.availableDayMask } as any },
      { onSuccess: () => setStep(3), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) },
    );
  }

  async function doLicence(vals: any) {
    if (!vals.trade) { setStep(4); return; }
    submitLicence.mutate(
      { data: { trade: vals.trade, issuingState: vals.issuingState, licenceNumber: vals.licenceNumber, licenceClass: vals.licenceClass, isSelfDeclared: vals.isSelfDeclared } as any },
      { onSuccess: () => setStep(4), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) },
    );
  }

  async function doInsurance(vals: any) {
    submitInsurance.mutate(
      { data: { optedOut: vals.optedOut, insurer: vals.insurer, policyNumber: vals.policyNumber } as any },
      { onSuccess: () => setStep(5), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) },
    );
  }

  async function doCheckout(plan: "monthly" | "annual") {
    createCheckout.mutate(
      { data: { plan } as any },
      {
        onSuccess: (res: any) => {
          if (res.checkoutUrl.includes("checkout=success")) {
            if (user) setUser({ ...user, onboardingComplete: true });
            setLocation("/tradie/dashboard");
          } else {
            window.location.href = res.checkoutUrl;
          }
        },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      },
    );
  }

  const progress = ((step) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Zap className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>TradieAfterDark</span>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <Progress value={progress} className="h-1.5" data-testid="onboarding-progress" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div data-testid="onboarding-step-identity">
              <h2 className="text-xl font-bold mb-1">About You</h2>
              <p className="text-muted-foreground text-sm mb-6">Tell us who you are</p>
              <Form {...identityForm}>
                <form onSubmit={identityForm.handleSubmit(doIdentity)} className="space-y-4">
                  <FormField control={identityForm.control} name="legalName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal name</FormLabel>
                      <FormControl><Input placeholder="Full legal name" data-testid="input-legal-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={identityForm.control} name="dob" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of birth</FormLabel>
                        <FormControl><Input type="date" data-testid="input-dob" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={identityForm.control} name="mobile" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile number</FormLabel>
                        <FormControl><Input type="tel" placeholder="04XX XXX XXX" data-testid="input-mobile" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={identityForm.control} name="homeSuburb" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home suburb</FormLabel>
                      <FormControl><Input placeholder="e.g. Fortitude Valley" data-testid="input-suburb" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={identityForm.control} name="homeState" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-state" {...field}>
                          {AUS_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={identityForm.control} name="abn" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ABN</FormLabel>
                      <FormControl><Input placeholder="11 digit ABN" data-testid="input-abn" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={submitIdentity.isPending} data-testid="button-next-identity">
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {/* Step 1: Trade Info */}
          {step === 1 && (
            <div data-testid="onboarding-step-trade">
              <h2 className="text-xl font-bold mb-1">Your Trade</h2>
              <p className="text-muted-foreground text-sm mb-6">Tell customers what you do</p>
              <Form {...tradeForm}>
                <form onSubmit={tradeForm.handleSubmit(doTrade)} className="space-y-4">
                  <FormField control={tradeForm.control} name="displayName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display name / business name</FormLabel>
                      <FormControl><Input placeholder="e.g. Mike's Electrical" data-testid="input-display-name" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Primary trade</FormLabel>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-primary-trade"
                      {...tradeForm.register("selectedTrade" as any)}
                    >
                      <option value="">Select trade…</option>
                      {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormItem>
                  <FormField control={tradeForm.control} name="bio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl><Textarea placeholder="Describe your experience and services…" rows={3} data-testid="textarea-bio" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={tradeForm.control} name="hourlyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly rate ($)</FormLabel>
                        <FormControl><Input type="number" min={0} data-testid="input-hourly-rate" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={tradeForm.control} name="yearsExp" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years experience</FormLabel>
                        <FormControl><Input type="number" min={0} data-testid="input-years-exp" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={tradeForm.control} name="postcodesText" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service postcodes (space or comma separated)</FormLabel>
                      <FormControl><Input placeholder="4000 4001 4005" data-testid="input-postcodes" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1" data-testid="button-back-trade">Back</Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white" disabled={submitTrade.isPending} data-testid="button-next-trade">
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Step 2: Availability */}
          {step === 2 && (
            <div data-testid="onboarding-step-availability">
              <h2 className="text-xl font-bold mb-1">Availability</h2>
              <p className="text-muted-foreground text-sm mb-6">When are you available for after-hours work?</p>
              <Form {...availForm}>
                <form onSubmit={availForm.handleSubmit(doAvailability)} className="space-y-5">
                  <FormField control={availForm.control} name="availableEvenings" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-evenings" /></FormControl>
                      <div>
                        <FormLabel className="text-base">Available evenings</FormLabel>
                        <p className="text-xs text-muted-foreground">Mon–Fri after 5pm</p>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={availForm.control} name="availableWeekends" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-weekends" /></FormControl>
                      <div>
                        <FormLabel className="text-base">Available weekends</FormLabel>
                        <p className="text-xs text-muted-foreground">Sat & Sun all day</p>
                      </div>
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" data-testid="button-back-availability">Back</Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white" disabled={submitAvailability.isPending} data-testid="button-next-availability">
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Step 3: Licence */}
          {step === 3 && (
            <div data-testid="onboarding-step-licence">
              <h2 className="text-xl font-bold mb-1">Licence (optional)</h2>
              <p className="text-muted-foreground text-sm mb-6">Add your trade licence for verification</p>
              <Form {...licenceForm}>
                <form onSubmit={licenceForm.handleSubmit(doLicence)} className="space-y-4">
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-licence-trade"
                      {...licenceForm.register("trade")}
                    >
                      <option value="">Skip this step</option>
                      {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormItem>
                  <FormField control={licenceForm.control} name="issuingState" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issuing state</FormLabel>
                      <FormControl>
                        <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-issuing-state" {...field}>
                          {AUS_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={licenceForm.control} name="licenceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Licence number (optional)</FormLabel>
                      <FormControl><Input placeholder="e.g. 1234567" data-testid="input-licence-number" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={licenceForm.control} name="isSelfDeclared" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-self-declared" /></FormControl>
                      <FormLabel className="font-normal text-sm">I self-declare I hold this licence (document upload optional)</FormLabel>
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1" data-testid="button-back-licence">Back</Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white" disabled={submitLicence.isPending} data-testid="button-next-licence">
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Step 4: Insurance */}
          {step === 4 && (
            <div data-testid="onboarding-step-insurance">
              <h2 className="text-xl font-bold mb-1">Insurance</h2>
              <p className="text-muted-foreground text-sm mb-6">Public liability insurance details</p>
              <Form {...insuranceForm}>
                <form onSubmit={insuranceForm.handleSubmit(doInsurance)} className="space-y-4">
                  <FormField control={insuranceForm.control} name="optedOut" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-no-insurance" /></FormControl>
                      <FormLabel className="font-normal text-sm">I don&apos;t have public liability insurance</FormLabel>
                    </FormItem>
                  )} />
                  {!insuranceForm.watch("optedOut") && (
                    <>
                      <FormField control={insuranceForm.control} name="insurer" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance provider</FormLabel>
                          <FormControl><Input placeholder="e.g. CGU Insurance" data-testid="input-insurer" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={insuranceForm.control} name="policyNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policy number</FormLabel>
                          <FormControl><Input placeholder="e.g. POL-123456" data-testid="input-policy-number" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </>
                  )}
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1" data-testid="button-back-insurance">Back</Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white" disabled={submitInsurance.isPending} data-testid="button-next-insurance">
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Step 5: Payment */}
          {step === 5 && (
            <div data-testid="onboarding-step-payment">
              <div className="text-center mb-6">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-1">Almost there!</h2>
                <p className="text-muted-foreground text-sm">Choose your subscription plan to go live</p>
              </div>

              <div className="space-y-4">
                <div className="border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">Monthly</p>
                      <p className="text-xs text-muted-foreground">Cancel anytime</p>
                    </div>
                    <p className="text-2xl font-bold">$49<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    onClick={() => doCheckout("monthly")}
                    disabled={createCheckout.isPending}
                    data-testid="button-subscribe-monthly"
                  >
                    Subscribe Monthly
                  </Button>
                </div>

                <div className="border border-primary/40 rounded-xl p-5 bg-primary/5 relative">
                  <div className="absolute -top-3 right-4">
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">Save 20%</span>
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">Annual</p>
                      <p className="text-xs text-muted-foreground">Best value · $469/yr</p>
                    </div>
                    <p className="text-2xl font-bold">$39<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    onClick={() => doCheckout("annual")}
                    disabled={createCheckout.isPending}
                    data-testid="button-subscribe-annual"
                  >
                    Subscribe Annually
                  </Button>
                </div>
              </div>

              <button
                onClick={() => setStep(4)}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center"
                data-testid="button-back-payment"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
