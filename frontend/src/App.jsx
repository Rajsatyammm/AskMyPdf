import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUGGESTIONS = [
  "Give me a concise summary",
  "What are the key takeaways?",
  "What should I pay attention to?",
];

async function requestJson(url, options) {
  const response = await fetch(`${API_URL}${url}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.detail || "Something went wrong. Please try again.");
  }
  return result;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function App() {
  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    requestJson("/api/health")
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function uploadFile(file) {
    setErrorMessage("");
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("That file doesn’t look like a PDF. Choose a .pdf file to continue.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("This PDF is larger than 20 MB. Choose a smaller file to continue.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const uploaded = await requestJson("/api/documents", {
        method: "POST",
        body: formData,
      });
      const previousDocument = document;
      setDocument({
        id: uploaded.document_id,
        name: uploaded.filename,
        pageCount: uploaded.page_count,
        size: file.size,
      });
      setMessages([]);
      setQuestion("");
      if (previousDocument) {
        fetch(`${API_URL}/api/documents/${previousDocument.id}`, { method: "DELETE" }).catch(
          () => {},
        );
      }
    } catch (error) {
      setErrorMessage(error.message || "The PDF couldn’t be uploaded. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeDocument() {
    if (!document) return;
    setErrorMessage("");
    try {
      const response = await fetch(`${API_URL}/api/documents/${document.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove the current PDF. Please try again.");
      setDocument(null);
      setMessages([]);
      setQuestion("");
    } catch (error) {
      setErrorMessage(error.message || "Could not remove the current PDF.");
    }
  }

  async function sendQuestion(event, suggestedQuestion) {
    event?.preventDefault();
    const text = (suggestedQuestion ?? question).trim();
    if (!text || !document || isSending) return;

    setErrorMessage("");
    setQuestion("");
    setIsSending(true);
    const conversationHistory = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);

    try {
      const result = await requestJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: document.id,
          question: text,
          history: conversationHistory,
        }),
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
        },
      ]);
    } catch (error) {
      setErrorMessage(error.message || "Your message couldn’t be sent. Please try again.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    uploadFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7f3] text-[#17251f]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => uploadFile(event.target.files?.[0])}
      />

      <aside className="hidden w-[286px] shrink-0 flex-col bg-[#122a23] px-5 pb-5 pt-6 text-white lg:flex">
        <a href="/" className="mb-10 flex items-center gap-3 px-1" aria-label="Folio home">
          <span className="flex size-10 items-center justify-center rounded-[14px] bg-[#d8f487] text-[#18352b]">
            <BookOpen size={21} strokeWidth={2.3} />
          </span>
          <span className="text-[21px] font-semibold tracking-[-0.8px]">folio</span>
          <span className="ml-auto rounded-full border border-white/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[1.2px] text-white/45">
            BETA
          </span>
        </a>

        <div className="mb-4 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[1.65px] text-white/40">
            Your workspace
          </p>
          {document && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label="Upload another PDF"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {document ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d8f487]/10 text-[#d8f487]">
                <FileText size={19} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[13px] font-medium text-white/90">{document.name}</p>
                <p className="mt-1 text-[11px] text-white/40">
                  {document.pageCount} {document.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {formatFileSize(document.size)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-3">
              <CheckCircle2 size={14} className="text-[#d8f487]" />
              <span className="text-[11px] text-white/65">Ready to chat</span>
              <button
                type="button"
                onClick={removeDocument}
                className="ml-auto rounded-md p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
                aria-label="Remove PDF"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isUploading}
            className={`group flex min-h-[174px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center transition ${
              isDragging
                ? "border-[#d8f487] bg-[#d8f487]/10"
                : "border-white/15 bg-white/[0.035] hover:border-white/30 hover:bg-white/[0.065]"
            }`}
          >
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#d8f487]/10 text-[#d8f487]">
              {isUploading ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : (
                <FileUp size={20} />
              )}
            </span>
            <span className="text-[13px] font-medium text-white/85">
              {isUploading ? "Reading your PDF…" : "Add your first PDF"}
            </span>
            <span className="mt-1.5 text-[11px] leading-relaxed text-white/40">
              Drop it here or browse files
              <br />
              PDF up to 20 MB
            </span>
          </button>
        )}

        {document && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <Plus size={15} />
            Add a different PDF
          </button>
        )}

        <div className="mt-auto rounded-2xl bg-[#1b392f] p-4">
          <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-white/[0.08] text-[#d8f487]">
            <Sparkles size={16} />
          </div>
          <p className="text-[12px] font-medium text-white/90">A little more clarity.</p>
          <p className="mt-1.5 text-[11px] leading-[1.65] text-white/45">
            Ask questions, explore ideas, and find the details that matter in your document.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 px-1 text-[10px] text-white/35">
          <span
            className={`size-1.5 rounded-full ${
              apiStatus === "online"
                ? "bg-[#bce874]"
                : apiStatus === "offline"
                  ? "bg-[#f08f77]"
                  : "animate-pulse bg-white/40"
            }`}
          />
          {apiStatus === "online"
            ? "Connected to your workspace"
            : apiStatus === "offline"
              ? "API is offline"
              : "Connecting…"}
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#e8eae4] bg-[#f9faf7]/90 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e9f3e3] text-[#336148] lg:hidden">
              <BookOpen size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[#435148]">
                {document ? document.name : "Your reading room"}
              </p>
              <p className="mt-0.5 hidden text-[10px] tracking-[0.15px] text-[#9ba39b] sm:block">
                {document
                  ? `${document.pageCount} ${document.pageCount === 1 ? "page" : "pages"} · PDF conversation`
                  : "A thoughtful space for your documents"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#e7eae3] bg-white px-3 py-1.5 text-[10px] font-medium text-[#7a857c] sm:flex">
              <Globe2 size={12} />
              AI-powered
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-xl bg-[#183b2e] px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#245440] disabled:opacity-60 sm:px-4 sm:text-xs"
            >
              {isUploading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              <span>{document ? "Change PDF" : "Upload PDF"}</span>
            </button>
          </div>
        </header>

        <section
          className={`chat-surface relative flex min-h-0 flex-1 flex-col overflow-hidden ${
            isDragging ? "drop-active" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center rounded-[28px] border-2 border-dashed border-[#55836a] bg-[#f6f9ef]/95 backdrop-blur-sm">
              <div className="text-center">
                <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-[#e7f2d8] text-[#3d674c]">
                  <FileUp size={25} />
                </span>
                <p className="text-sm font-semibold text-[#1b382c]">Drop your PDF to get started</p>
                <p className="mt-1 text-xs text-[#839086]">PDF files up to 20 MB</p>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:px-12">
              <div className="w-full max-w-[740px]">
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-5 flex size-[58px] items-center justify-center rounded-[20px] border border-[#e3e9dc] bg-white text-[#466b4c] shadow-[0_7px_26px_rgba(28,57,39,0.06)]">
                    <MessageCircle size={24} strokeWidth={1.8} />
                  </div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-[#779276]">
                    Your reading room
                  </p>
                  <h1 className="text-balance text-[30px] font-semibold leading-[1.16] tracking-[-1.35px] text-[#1c2e25] sm:text-[39px]">
                    {document ? (
                      <>
                        Let’s get into
                        <br className="hidden sm:block" /> the details.
                      </>
                    ) : (
                      <>
                        A good question
                        <br className="hidden sm:block" /> changes everything.
                      </>
                    )}
                  </h1>
                  <p className="mx-auto mt-3 max-w-[410px] text-[13px] leading-[1.75] text-[#879087] sm:text-sm">
                    {document
                      ? `Your ${document.pageCount}-page document is ready. What would you like to know?`
                      : "Bring a PDF into the conversation. Ask about the big picture, the small print, or anything in between."}
                  </p>
                </div>

                {!document ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    disabled={isUploading}
                    className="upload-card group mx-auto flex w-full max-w-[495px] items-center gap-4 rounded-[20px] border border-[#e3e8df] bg-white p-4 text-left shadow-[0_10px_35px_rgba(42,62,43,0.045)] transition hover:-translate-y-0.5 hover:border-[#bed2b8] hover:shadow-[0_14px_38px_rgba(42,62,43,0.08)] sm:p-5"
                  >
                    <span className="flex size-[49px] shrink-0 items-center justify-center rounded-[15px] bg-[#edf4e7] text-[#497253]">
                      {isUploading ? (
                        <LoaderCircle size={21} className="animate-spin" />
                      ) : (
                        <FileUp size={21} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#2c4033]">
                        {isUploading ? "Reading your document…" : "Upload a PDF to begin"}
                      </span>
                      <span className="mt-1 block text-[11px] text-[#929b91]">
                        Drop your file here or browse · Up to 20 MB
                      </span>
                    </span>
                    <span className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-[#f5f7f2] text-[#758271] sm:flex">
                      <ArrowUp size={15} className="rotate-90" />
                    </span>
                  </button>
                ) : (
                  <div className="mx-auto grid w-full max-w-[650px] gap-2.5 sm:grid-cols-3">
                    {SUGGESTIONS.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={(event) => sendQuestion(event, suggestion)}
                        disabled={isSending}
                        className="group flex min-h-[74px] items-start gap-2.5 rounded-[15px] border border-[#e6e9e2] bg-white px-3.5 py-3 text-left text-[11px] font-medium leading-[1.55] text-[#59675c] shadow-[0_3px_12px_rgba(42,62,43,0.025)] transition hover:border-[#bdcfb7] hover:bg-[#fbfcf9] disabled:opacity-50"
                      >
                        <span className="mt-0.5 text-[#849880]">
                          {index === 0 ? (
                            <FileText size={14} />
                          ) : index === 1 ? (
                            <Sparkles size={14} />
                          ) : (
                            <Check size={14} />
                          )}
                        </span>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {isUploading && (
                  <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#829083]">
                    <LoaderCircle size={13} className="animate-spin" />
                    Extracting text and preparing your conversation…
                  </p>
                )}
                {errorMessage && (
                  <p
                    role="alert"
                    className="mx-auto mt-4 max-w-[495px] rounded-xl border border-[#f0d5cb] bg-[#fff8f5] px-4 py-3 text-xs leading-relaxed text-[#a24e38]"
                  >
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-8 sm:px-8 lg:px-12">
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-7">
                <div className="flex items-center justify-center gap-2 pb-1 text-[10px] font-medium tracking-[0.2px] text-[#9ca59c]">
                  <span className="h-px w-8 bg-[#e2e6dd]" />
                  Your conversation
                  <span className="h-px w-8 bg-[#e2e6dd]" />
                </div>
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex gap-3.5 ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[11px] ${
                        message.role === "user"
                          ? "bg-[#e9eee6] text-[#50624f]"
                          : "bg-[#183b2e] text-[#d8f487]"
                      }`}
                    >
                      {message.role === "user" ? (
                        <span className="text-[11px] font-semibold">Y</span>
                      ) : (
                        <BookOpen size={15} />
                      )}
                    </span>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] ${
                        message.role === "user" ? "text-right" : ""
                      }`}
                    >
                      <p className="mb-1.5 text-[10px] font-medium text-[#98a098]">
                        {message.role === "user" ? "You" : "Folio"}
                      </p>
                      <div
                        className={`rounded-[17px] px-4 py-3.5 text-[13px] leading-[1.8] sm:px-[18px] ${
                          message.role === "user"
                            ? "rounded-tr-[5px] bg-[#e9eee6] text-[#344439]"
                            : "rounded-tl-[5px] border border-[#e8eae4] bg-white text-[#3e4a40] shadow-[0_4px_18px_rgba(30,50,33,0.025)]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.sources?.length > 0 && (
                          <div className="mt-4 border-t border-[#edf0e9] pt-3">
                            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[1.1px] text-[#8c988b]">
                              <BookOpen size={11} />
                              From your PDF
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {message.sources.map((source) => (
                                <span
                                  key={`${message.id}-${source.page}`}
                                  title={source.excerpt}
                                  className="rounded-full border border-[#e8ede3] bg-[#f7f9f4] px-2.5 py-1 text-[10px] font-medium text-[#59705a]"
                                >
                                  Page {source.page}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {isSending && (
                  <article className="flex gap-3.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-[#183b2e] text-[#d8f487]">
                      <BookOpen size={15} />
                    </span>
                    <div>
                      <p className="mb-2 text-[10px] font-medium text-[#98a098]">Folio</p>
                      <div className="flex items-center gap-2 rounded-[17px] rounded-tl-[5px] border border-[#e8eae4] bg-white px-4 py-3.5 text-xs text-[#89958a]">
                        <LoaderCircle size={14} className="animate-spin text-[#69836b]" />
                        Looking through your document…
                      </div>
                    </div>
                  </article>
                )}
                {errorMessage && (
                  <div
                    role="alert"
                    className="ml-11 max-w-[540px] rounded-xl border border-[#f0d5cb] bg-[#fff8f5] px-4 py-3 text-xs leading-relaxed text-[#a24e38]"
                  >
                    {errorMessage}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          <footer className="shrink-0 border-t border-[#e9ebe5] bg-[#f8f9f6]/95 px-4 pb-4 pt-4 sm:px-8 sm:pb-5 lg:px-12">
            <form onSubmit={(event) => sendQuestion(event)} className="mx-auto max-w-[760px]">
              <div
                className={`flex items-end gap-2 rounded-[19px] border bg-white p-2 shadow-[0_7px_26px_rgba(36,52,36,0.055)] transition focus-within:border-[#b8cbb4] focus-within:shadow-[0_8px_28px_rgba(36,75,45,0.09)] ${
                  document ? "border-[#e3e8df]" : "border-[#e8eae5] opacity-75"
                }`}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  maxLength={2000}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendQuestion(event);
                    }
                  }}
                  disabled={!document || isSending}
                  placeholder={
                    document ? "Ask anything about your PDF…" : "Upload a PDF to start asking…"
                  }
                  aria-label="Ask a question about your PDF"
                  className="max-h-32 min-h-[43px] flex-1 resize-y bg-transparent px-3 py-3 text-[12px] leading-relaxed text-[#36443a] outline-none placeholder:text-[#a5ada4] disabled:cursor-not-allowed sm:px-3.5 sm:text-[13px]"
                />
                <button
                  type="submit"
                  disabled={!document || !question.trim() || isSending}
                  aria-label="Send message"
                  className="mb-0.5 flex size-[39px] shrink-0 items-center justify-center rounded-[13px] bg-[#183b2e] text-white transition hover:bg-[#285741] disabled:cursor-not-allowed disabled:bg-[#edf0eb] disabled:text-[#a9b0a7]"
                >
                  {isSending ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.2} />
                  )}
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] text-[#a3aaa1] sm:text-[10px]">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={11} />
                  Answers are grounded in your document
                </span>
                <span className="hidden sm:block">Enter to send · Shift + Enter for a new line</span>
              </div>
            </form>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
