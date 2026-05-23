import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetJob, useGetMessages, useSendMessage, useAcceptJob, useStartJob, useCompleteJob, useCancelJob, useSubmitReview,
  getGetJobQueryKey, getGetMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useJobSocket, type WsMessage } from "@/hooks/use-job-socket";
import { ChevronLeft, Send, Star, AlertTriangle, Wifi, WifiOff } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ENQUIRY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  ACCEPTED: "bg-green-500/10 text-green-400 border-green-500/30",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/30",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/30",
  DISPUTED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [msgText, setMsgText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [liveMessages, setLiveMessages] = useState<WsMessage[]>([]);

  const { data: job, isLoading: jobLoading } = useGetJob(jobId, {
    query: { queryKey: getGetJobQueryKey(jobId), staleTime: 30_000 },
  });

  const { data: historicalMessages } = useGetMessages(jobId, {
    query: {
      queryKey: getGetMessagesQueryKey(jobId),
      staleTime: 60_000,
      refetchInterval: false,
    },
  });

  const seenIds = useRef(new Set<string>());

  const handleWsMessage = useCallback((msg: WsMessage) => {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);
    setLiveMessages(prev => [...prev, msg]);
  }, []);

  const { isConnected } = useJobSocket({
    jobId,
    onMessage: handleWsMessage,
    enabled: !!user && !!jobId,
  });

  useEffect(() => {
    if (!historicalMessages) return;
    const msgs = historicalMessages as any[];
    msgs.forEach((m: any) => seenIds.current.add(m.id));
    setLiveMessages([]);
  }, [historicalMessages]);

  const allMessages = [
    ...((historicalMessages as any[]) ?? []),
    ...liveMessages,
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const sendMsg = useSendMessage();
  const acceptJob = useAcceptJob();
  const startJob = useStartJob();
  const completeJob = useCompleteJob();
  const cancelJob = useCancelJob();
  const submitReview = useSubmitReview();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
    qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(jobId) });
  };

  function handleSend() {
    if (!msgText.trim()) return;
    sendMsg.mutate(
      { jobId, data: { body: msgText } as any },
      {
        onSuccess: (res: any) => {
          setMsgText("");
          const newMsg: WsMessage = {
            id: res.id,
            jobId: res.jobId,
            senderId: res.senderId,
            body: res.body,
            flagged: res.flagged,
            createdAt: res.createdAt,
          };
          if (!seenIds.current.has(newMsg.id)) {
            seenIds.current.add(newMsg.id);
            setLiveMessages(prev => [...prev, newMsg]);
          }
        },
        onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
      },
    );
  }

  function doAccept() {
    acceptJob.mutate(
      { jobId } as any,
      { onSuccess: invalidate, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) },
    );
  }

  function doStart() {
    startJob.mutate(
      { jobId } as any,
      { onSuccess: invalidate, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) },
    );
  }

  function doComplete() {
    completeJob.mutate(
      { jobId } as any,
      { onSuccess: invalidate, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) },
    );
  }

  function doCancel() {
    cancelJob.mutate(
      { jobId, data: { reason: "Cancelled by user" } as any },
      { onSuccess: invalidate, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) },
    );
  }

  function doReview() {
    submitReview.mutate(
      { jobId, data: { rating: reviewRating, comment: reviewComment } as any },
      {
        onSuccess: () => { setShowReviewForm(false); invalidate(); toast({ title: "Review submitted!" }); },
        onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
      },
    );
  }

  if (jobLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const j = job as any;
  if (!j) return null;

  const isTradie = user?.role === "TRADIE";
  const isCustomer = user?.role === "CUSTOMER";

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col" style={{ height: "100vh" }}>
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={() => setLocation("/jobs")} className="text-muted-foreground hover:text-foreground" data-testid="button-back-jobs">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold truncate" data-testid="heading-job-detail">
              {isTradie ? j.customer?.email ?? "Customer" : j.tradie?.displayName ?? "Tradie"}
            </h1>
            <Badge className={`text-xs border ${STATUS_COLORS[j.status] ?? ""}`} data-testid="badge-job-status">
              {j.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate" data-testid="text-job-description-preview">{j.description}</p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0" title={isConnected ? "Real-time connected" : "Connecting…"}>
          {isConnected
            ? <Wifi className="w-3.5 h-3.5 text-green-400" />
            : <WifiOff className="w-3.5 h-3.5 text-muted-foreground/50" />
          }
          <span className="hidden sm:inline">{isConnected ? "Live" : "Connecting"}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {isTradie && j.status === "ENQUIRY" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={doAccept} disabled={acceptJob.isPending} data-testid="button-accept-job">
              Accept
            </Button>
          )}
          {isTradie && j.status === "ACCEPTED" && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={doStart} disabled={startJob.isPending} data-testid="button-start-job">
              Start
            </Button>
          )}
          {j.status === "IN_PROGRESS" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={doComplete} disabled={completeJob.isPending} data-testid="button-complete-job">
              Complete
            </Button>
          )}
          {isCustomer && j.status === "COMPLETED" && !j.review && (
            <Button size="sm" variant="outline" onClick={() => setShowReviewForm(true)} data-testid="button-leave-review">
              <Star className="w-4 h-4 mr-1" />Review
            </Button>
          )}
          {["ENQUIRY", "ACCEPTED"].includes(j.status) && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={doCancel} disabled={cancelJob.isPending} data-testid="button-cancel-job">
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" data-testid="messages-list">
        {allMessages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10" data-testid="text-no-messages">
            No messages yet. Start the conversation!
          </p>
        )}
        {allMessages.map((m: any) => {
          const isMine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`} data-testid={`message-${m.id}`}>
              <div
                className={`max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}
              >
                {m.body}
                {m.flagged && (
                  <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
                    <AlertTriangle className="w-3 h-3" />
                    Contact info detected
                  </div>
                )}
                <div className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                  {new Date(m.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      {!["COMPLETED", "CANCELLED"].includes(j.status) && (
        <div className="border-t border-border px-6 py-4 flex gap-3 flex-shrink-0 bg-card" data-testid="message-input-area">
          <Textarea
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            placeholder="Type a message…"
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            data-testid="textarea-message"
          />
          <Button
            className="bg-primary hover:bg-primary/90 text-white flex-shrink-0 self-end"
            onClick={handleSend}
            disabled={!msgText.trim() || sendMsg.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Review modal */}
      {showReviewForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="modal-review">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-semibold text-lg mb-4">Leave a Review</h2>
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setReviewRating(i + 1)}
                  data-testid={`star-rating-${i + 1}`}
                >
                  <Star className={`w-8 h-8 ${i < reviewRating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Optional comment..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={3}
              className="mb-4"
              data-testid="textarea-review-comment"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowReviewForm(false)} className="flex-1" data-testid="button-cancel-review">Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-white" onClick={doReview} disabled={submitReview.isPending} data-testid="button-submit-review">
                Submit Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
