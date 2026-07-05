import React, { useState, useEffect, useRef } from "react";
import * as math from "mathjs";
import ReactMarkdown from "react-markdown";
import {
  Search,
  Sparkles,
  Cpu,
  Calculator,
  History,
  BookOpen,
  Send,
  Trash2,
  HelpCircle,
  Activity,
  RefreshCw,
  Copy,
  Plus,
  Minus,
  Check,
  ArrowRight,
  ExternalLink,
  FileText,
  Clock,
  Terminal,
  Brain,
  Wifi,
  ChevronRight,
  Delete,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  Play,
  Pause,
  Loader2
} from "lucide-react";
import {
  generateProceduralImage,
  generateProceduralMusic,
  generateProceduralVideo
} from "./utils/mediaGenerators";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolActivities?: Array<{
    type: string;
    query?: string;
    title?: string;
    expression?: string;
    timestamp: string;
  }>;
}

interface WikiResult {
  title: string;
  snippet: string;
  pageid: number;
}

export default function App() {
  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am **PetnanAI**, your ultra-smart, multi-threaded intelligence companion. I can solve highly complex mathematical equations, search global archives on Wikipedia in real-time, and answer deep technical queries. \n\nHow can I accelerate your cognition today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeThoughts, setActiveThoughts] = useState<any[]>([]);

  // Wikipedia Sidebar States
  const [wikiQuery, setWikiQuery] = useState("");
  const [wikiResults, setWikiResults] = useState<WikiResult[]>([
    {
      title: "Artificial intelligence",
      snippet: "Intelligence demonstrated by machines, unlike the natural intelligence displayed by humans and animals...",
      pageid: 1164,
    },
    {
      title: "Quantum computing",
      snippet: "A rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers...",
      pageid: 24701,
    },
  ]);
  const [isSearchingWiki, setIsSearchingWiki] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<{ title: string; extract: string } | null>(null);
  const [isFetchingArticle, setIsFetchingArticle] = useState(false);

  // Calculator States
  const [calcDisplay, setCalcDisplay] = useState("");
  const [calcResult, setCalcResult] = useState<string>("");
  const [calcHistory, setCalcHistory] = useState<string[]>([
    "sqrt(144 * 2) / sin(pi / 4) = 24.0",
    "100 * (1.05 ^ 10) = 162.889",
    "mean([12, 19, 8, 4, 15]) = 11.6",
  ]);

  // Priority subject targeting states
  const [prioritySubject, setPrioritySubject] = useState<string>("General");
  const [customPriority, setCustomPriority] = useState<string>("");

  // Right Column Sidebar tab routing
  const [rightActiveTab, setRightActiveTab] = useState<"calculator" | "synthesizer">("calculator");

  // Media Synthesizer States
  const [synthPrompt, setSynthPrompt] = useState<string>("Retro synth cyberpunk neon grid");
  const [synthType, setSynthType] = useState<"image" | "video" | "music">("image");
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthProgress, setSynthProgress] = useState<number>(0);
  const [synthesizedImage, setSynthesizedImage] = useState<string | null>(null);
  const [synthesizedVideo, setSynthesizedVideo] = useState<string | null>(null);
  const [synthesizedMusic, setSynthesizedMusic] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState<boolean>(false);

  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // System Telemetry Load states (aesthetic & responsive values)
  const [cognitionLoad, setCognitionLoad] = useState(12);
  const [memoryBuffer, setMemoryBuffer] = useState(48);
  const [dataIndexed, setDataIndexed] = useState(99.9);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Randomly fluctuate Cognition Load for high-tech aesthetic
  useEffect(() => {
    const interval = setInterval(() => {
      setCognitionLoad((prev) => {
        const delta = Math.floor(Math.random() * 9) - 4; // -4 to +4
        return Math.max(5, Math.min(prev + delta, 95));
      });
      setMemoryBuffer((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(20, Math.min(prev + delta, 85));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Wiki Search function
  const handleWikiSearch = async (queryToSearch?: string) => {
    const q = queryToSearch || wikiQuery;
    if (!q.trim()) return;
    setIsSearchingWiki(true);
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const results = data.query?.search || [];
      setWikiResults(results.map((item: any) => ({
        title: item.title,
        snippet: (item.snippet || "").replace(/<\/?[^>]+(>|$)/g, ""), // strip HTML
        pageid: item.pageid,
      })));
    } catch (err) {
      console.error("Wikipedia fetch error", err);
    } finally {
      setIsSearchingWiki(false);
    }
  };

  // Fetch full article extract to read
  const handleReadWikiArticle = async (title: string) => {
    setIsFetchingArticle(true);
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== "-1") {
        setSelectedArticle({
          title: pages[pageId].title,
          extract: pages[pageId].extract || "No description available.",
        });
      } else {
        setSelectedArticle({
          title,
          extract: "Could not retrieve introductory summary for this Wikipedia article.",
        });
      }
    } catch (err) {
      console.error("Wikipedia article retrieve error", err);
    } finally {
      setIsFetchingArticle(false);
    }
  };

  // Multimedia Synthesis Execution
  const handleSynthesis = async () => {
    if (!synthPrompt.trim() || isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthProgress(5);
    
    // Stop any playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setMusicPlaying(false);
    }

    try {
      if (synthType === "image") {
        setSynthProgress(20);
        const dataUrl = await generateProceduralImage(synthPrompt);
        setSynthProgress(70);
        setSynthesizedImage(dataUrl);
        setSynthProgress(100);
        setIsSynthesizing(false);
      } else if (synthType === "music") {
        setSynthProgress(15);
        const audioUrl = await generateProceduralMusic(synthPrompt, setSynthProgress);
        setSynthesizedMusic(audioUrl);
        setIsSynthesizing(false);
      } else if (synthType === "video") {
        setSynthProgress(10);
        if (videoCanvasRef.current) {
          const videoUrl = await generateProceduralVideo(synthPrompt, videoCanvasRef.current, setSynthProgress);
          setSynthesizedVideo(videoUrl);
        } else {
          // Fallback if ref not yet mounted
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = 600;
          tempCanvas.height = 400;
          const videoUrl = await generateProceduralVideo(synthPrompt, tempCanvas, setSynthProgress);
          setSynthesizedVideo(videoUrl);
        }
        setIsSynthesizing(false);
      }
    } catch (err) {
      console.error("Synthesis Core Error:", err);
      setIsSynthesizing(false);
    }
  };

  // Submit chat query to PetnanAI
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInputValue("");
    }
    setIsThinking(true);
    setActiveThoughts([]);

    try {
      // Build correct conversation history
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const activeSubject = prioritySubject === "Custom" ? customPriority : prioritySubject;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: history,
          prioritySubject: activeSubject
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to receive response from PetnanAI.");
      }

      const data = await response.json();
      
      if (data.activities && data.activities.length > 0) {
        setActiveThoughts(data.activities);
      }

      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.text || "I processed your request, but was unable to formulate a text response.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolActivities: data.activities || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: `⚠️ **System Error**: ${error.message || "An unexpected error occurred while communicating with the PetnanAI server. Please check your API key configuration in the Secrets panel."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // Calculator key press
  const handleCalcKeyPress = (key: string) => {
    if (key === "C") {
      setCalcDisplay("");
      setCalcResult("");
    } else if (key === "Del") {
      setCalcDisplay((prev) => prev.slice(0, -1));
    } else if (key === "=") {
      try {
        if (!calcDisplay.trim()) return;
        const res = math.evaluate(calcDisplay);
        const resStr = typeof res === "object" ? res.toString() : String(res);
        setCalcResult(resStr);
        setCalcHistory((prev) => [`${calcDisplay} = ${resStr}`, ...prev.slice(0, 4)]);
      } catch (err: any) {
        setCalcResult("Error");
      }
    } else {
      // Add space for clean readability of operators if preferred, or keep compact
      setCalcDisplay((prev) => prev + key);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Pre-seed chat prompts
  const samplePrompts = [
    { text: "Evaluate the mathematical standard deviation of [12, 19, 8, 4, 15]", icon: Calculator },
    { text: "Who was Alan Turing according to Wikipedia?", icon: BookOpen },
    { text: "Find the prime factors of 1024", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen w-full overflow-y-auto lg:overflow-hidden flex flex-col font-sans bg-slate-950 text-white relative">
      
      {/* Decorative Vibrant Mesh Gradients — Light Green, Yellow, Purple, Sky Blue */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/20 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-purple-600/20 blur-[130px]"></div>
        <div className="absolute top-[25%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-sky-400/15 blur-[100px]"></div>
        <div className="absolute bottom-[20%] left-[15%] w-[30vw] h-[30vw] rounded-full bg-yellow-400/10 blur-[110px]"></div>
      </div>

      {/* Main Header */}
      <header className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 md:px-8 md:py-5 backdrop-blur-md bg-white/5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 via-sky-400 to-purple-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <span className="text-slate-950 font-black text-xl">P</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-yellow-300 to-sky-400 bg-clip-text text-transparent">
                PetnanAI
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded">v4.0</span>
            </div>
            <p className="text-xs text-slate-400">Omniscient Grounding & Neural Calculator System</p>
          </div>
        </div>

        {/* Header Telemetry stats */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
            <span className="text-xs font-semibold text-emerald-400 tracking-wide flex items-center gap-1.5">
              <Wifi size={12} /> Live Grounding Active
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-medium">SERVER LATENCY</span>
              <span className="font-mono text-emerald-400 font-bold">14ms</span>
            </div>
            <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-medium">NEURAL LOAD</span>
              <span className="font-mono text-yellow-300 font-bold">{cognitionLoad}%</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Content Area */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto lg:overflow-hidden">
        
        {/* LEFT COLUMN: Control Hub & Wikipedia Grounding Engine (3 cols on lg) */}
        <section className="lg:col-span-3 flex flex-col gap-4 h-full lg:min-h-0 overflow-y-auto pr-1">
          
          {/* 1. PetnanAI Targeted Focus Priorities */}
          <div id="knowledge-focus-panel" className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col shrink-0 shadow-2xl">
            <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2 shrink-0">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-xs tracking-wider">
                <Sparkles size={14} className="text-emerald-400 animate-pulse" />
                Knowledge Focus Target
              </div>
              <span className="text-[9px] text-emerald-400 bg-emerald-400/10 uppercase font-mono px-1.5 py-0.5 rounded border border-emerald-400/20">Prioritized</span>
            </div>

            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Define the specific domain PetnanAI prioritizes when searching Wikipedia or answering.
            </p>

            {/* Grid of Predefined Priorities */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {[
                { name: "General", label: "✨ General" },
                { name: "Science", label: "🔬 Science" },
                { name: "History", label: "🏛️ History" },
                { name: "Technology", label: "💻 Tech" },
                { name: "Mathematics", label: "📐 Math" },
                { name: "Custom", label: "🖊️ Custom" },
              ].map((subject) => {
                const isActive = prioritySubject === subject.name;
                return (
                  <button
                    id={`btn-subject-${subject.name.toLowerCase()}`}
                    key={subject.name}
                    onClick={() => {
                      setPrioritySubject(subject.name);
                    }}
                    className={`text-[10px] py-1.5 px-2 rounded-xl border text-left transition-all ${
                      isActive
                        ? "bg-emerald-400/15 border-emerald-400 text-emerald-300 font-bold shadow-sm shadow-emerald-400/10"
                        : "bg-slate-950/40 border-white/10 hover:border-white/25 text-slate-300 hover:text-white"
                    }`}
                  >
                    {subject.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Priority input field */}
            {prioritySubject === "Custom" && (
              <div className="shrink-0 mt-1">
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                  Custom Priority Domain:
                </label>
                <input
                  id="custom-priority-input"
                  type="text"
                  value={customPriority}
                  onChange={(e) => setCustomPriority(e.target.value)}
                  placeholder="e.g. Quantum Physics, Space..."
                  className="w-full bg-slate-950/60 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 text-white placeholder-slate-600 transition-all"
                />
              </div>
            )}
          </div>

          {/* 2. Short-Term Conversational Memory Control */}
          <div id="memory-control-panel" className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col shrink-0 shadow-2xl">
            <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2 shrink-0">
              <div className="flex items-center gap-2 text-purple-400 font-bold uppercase text-xs tracking-wider">
                <Brain size={14} className="text-purple-400" />
                Short-Term Memory
              </div>
              <span className="text-[9px] text-purple-400 bg-purple-400/10 uppercase font-mono px-1.5 py-0.5 rounded border border-purple-400/20">Sliding Cache</span>
            </div>

            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Maintains high-context short-term buffer of inputs/outputs to guide relevant follow-ups.
            </p>

            {/* Memory LED Indicator Cells */}
            <div className="bg-slate-950/60 rounded-2xl p-3 border border-white/5 mb-3">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-2 font-mono">
                <span>BUFFER SLOTS (MAX 10)</span>
                <span className="text-purple-300 font-bold">
                  {Math.min(10, messages.filter(m => m.id !== "welcome").length)} / 10 USED
                </span>
              </div>
              
              {/* LED list */}
              <div className="flex items-center justify-between gap-1 mb-2">
                {Array.from({ length: 10 }).map((_, index) => {
                  const activeMessages = messages.filter(m => m.id !== "welcome");
                  const hasMsg = index < activeMessages.length;
                  const msgRole = hasMsg ? activeMessages[index].role : null;
                  
                  // Color codes for memory types: User is Light green (emerald), Assistant is Purple
                  let ledBg = "bg-white/10 border-white/5";
                  if (hasMsg) {
                    if (msgRole === "user") {
                      ledBg = "bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]";
                    } else {
                      ledBg = "bg-purple-500 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]";
                    }
                  }
                  
                  return (
                    <div
                      key={index}
                      title={hasMsg ? `${activeMessages[index].role === "user" ? "User input" : "PetnanAI response"}: ${activeMessages[index].content.slice(0, 30)}...` : "Empty Memory slot"}
                      className={`h-2 flex-1 rounded-full border transition-all duration-300 ${ledBg}`}
                    />
                  );
                })}
              </div>

              {/* Memory summary list */}
              <div className="space-y-1 max-h-[60px] overflow-y-auto pr-1">
                {messages.filter(m => m.id !== "welcome").slice(-2).map((m, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-[9px] text-slate-300 truncate">
                    <span className={`font-black font-mono ${m.role === "user" ? "text-emerald-400" : "text-purple-400"}`}>
                      [{m.role === "user" ? "IN" : "OUT"}]
                    </span>
                    <span className="truncate opacity-80">{m.content}</span>
                  </div>
                ))}
                {messages.filter(m => m.id !== "welcome").length === 0 && (
                  <div className="text-[9px] text-slate-500 text-center font-mono">
                    No active conversational memory slots filled.
                  </div>
                )}
              </div>
            </div>

            <button
              id="btn-reset-memory"
              onClick={() => {
                setMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content: "Neural conversation cache has been reset manually. How can I guide your next line of thinking?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  }
                ]);
              }}
              className="w-full py-1.5 bg-purple-500/10 hover:bg-rose-500/20 border border-purple-500/20 hover:border-rose-500/30 text-[10px] text-purple-300 hover:text-rose-300 font-bold rounded-xl transition-all flex items-center justify-center gap-1"
            >
              <RefreshCw size={10} /> Reset Conversation Memory
            </button>
          </div>

          {/* 3. Wikipedia Grounding Engine */}
          <div id="wikipedia-grounding-panel" className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col overflow-hidden shadow-2xl min-h-[300px]">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2 shrink-0">
              <div className="flex items-center gap-2 text-sky-400 font-bold uppercase text-xs tracking-wider">
                <BookOpen size={14} className="text-sky-400 animate-pulse" />
                Wikipedia Grounding
              </div>
              <span className="text-[9px] text-slate-400 uppercase font-mono px-1.5 py-0.5 rounded bg-white/5">DB Grounded</span>
            </div>

            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Feed summaries instantly to PetnanAI context.
            </p>

            {/* Wiki Search Bar */}
            <div className="relative mb-3 shrink-0">
              <input
                id="wiki-search-input"
                type="text"
                value={wikiQuery}
                onChange={(e) => setWikiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWikiSearch()}
                placeholder="Search world archive..."
                className="w-full bg-slate-950/60 border border-white/15 rounded-xl pl-4 pr-10 py-2 text-xs focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 text-white placeholder-slate-500 transition-all"
              />
              <button
                id="btn-wiki-search"
                onClick={() => handleWikiSearch()}
                className="absolute right-2 top-2 text-slate-400 hover:text-sky-400 transition-colors"
                title="Search Wikipedia"
              >
                {isSearchingWiki ? (
                  <RefreshCw size={13} className="animate-spin text-sky-400" />
                ) : (
                  <Search size={13} />
                )}
              </button>
            </div>

            {/* Search Results list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin max-h-[220px]">
              {isSearchingWiki ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-[10px] gap-2">
                  <RefreshCw size={20} className="animate-spin text-sky-400" />
                  <span>Scanning Wikipedia...</span>
                </div>
              ) : wikiResults.length === 0 ? (
                <div className="text-center text-slate-500 py-6 text-[10px]">
                  No articles matches found.
                </div>
              ) : (
                wikiResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all flex flex-col group text-left"
                  >
                    <h3 className="text-xs font-bold text-white mb-1 flex items-center justify-between gap-1">
                      <span className="truncate group-hover:text-sky-300 transition-colors">{item.title}</span>
                      <ExternalLink size={9} className="text-slate-500 group-hover:text-sky-400 shrink-0" />
                    </h3>
                    <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2 opacity-80 mb-2 font-light">
                      {item.snippet}
                    </p>
                    <div className="flex items-center justify-between gap-1 mt-auto pt-1.5 border-t border-white/5">
                      <button
                        onClick={() => handleReadWikiArticle(item.title)}
                        className="text-[9px] text-sky-400 font-bold hover:text-sky-300 transition-colors flex items-center gap-0.5"
                      >
                        <FileText size={10} /> READ EXTRACT
                      </button>
                      <button
                        onClick={() => handleSendMessage(`Analyze and explain the Wikipedia article: "${item.title}".`)}
                        className="text-[9px] text-emerald-400 font-bold hover:text-emerald-300 transition-colors flex items-center gap-0.5"
                      >
                        ASK PETNAN <ChevronRight size={9} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* MIDDLE COLUMN: Primary Intelligent Interaction Chat Zone (6 cols on lg) */}
        <section className="lg:col-span-6 flex flex-col gap-6 h-full lg:min-h-0 min-h-[500px]">
          <div className="flex-1 backdrop-blur-2xl bg-slate-900/40 rounded-[32px] border border-white/10 p-4 md:p-6 flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Top Interactive Banner */}
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="text-purple-400 animate-pulse" size={18} />
                <span className="text-sm font-bold text-white">Petnan AI Central Intelligence Terminal</span>
              </div>
              <button
                onClick={() => {
                  setMessages([
                    {
                      id: "welcome",
                      role: "assistant",
                      content: "Chat cleared. I am ready for new directives. Input any mathematical formula or general queries to begin.",
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }
                  ]);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                title="Clear Chat History"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Chat Messages Feed container */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative group ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-emerald-600/35 to-sky-600/35 border border-emerald-400/20 text-white"
                        : "bg-white/5 border border-white/10 text-slate-200"
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between gap-6 mb-1 text-[10px] font-bold text-slate-400 border-b border-white/5 pb-1">
                      <span className="flex items-center gap-1">
                        {msg.role === "user" ? (
                          <span className="text-emerald-400 uppercase">You (Director)</span>
                        ) : (
                          <span className="text-purple-300 uppercase flex items-center gap-1">
                            <Sparkles size={10} className="text-yellow-300" /> PetnanAI
                          </span>
                        )}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Message content formatted using ReactMarkdown */}
                    <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {/* Tool executions logged inside assistant messages */}
                    {msg.toolActivities && msg.toolActivities.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2">
                        <div className="text-[10px] uppercase tracking-wider font-mono text-purple-400 flex items-center gap-1.5">
                          <Terminal size={12} /> Execution Engine telemetry
                        </div>
                        {msg.toolActivities.map((act, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg text-xs font-mono text-slate-300 border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></div>
                            {act.type === "wikipedia_search" && (
                              <span>[Wikipedia Search] Query: <b className="text-sky-300">"{act.query}"</b></span>
                            )}
                            {act.type === "wikipedia_article" && (
                              <span>[Wikipedia Retrieval] Title: <b className="text-sky-300">"{act.title}"</b></span>
                            )}
                            {act.type === "calculator" && (
                              <span>[Neural Calculator] Expression: <b className="text-emerald-300">"{act.expression}"</b></span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Floating helper copy action */}
                    <button
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="absolute right-2 bottom-2 p-1 rounded bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-950/80 text-slate-400 hover:text-white"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Loader with Live Thinking Steps */}
              {isThinking && (
                <div className="flex flex-col items-start space-y-2">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-[85%] text-sm text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex space-x-1.5">
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-xs text-purple-300 font-bold tracking-wide uppercase animate-pulse">PetnanAI is calculating...</span>
                    </div>

                    {/* Active agent processes logged in real time */}
                    <div className="mt-3 p-3 bg-slate-950/80 rounded-xl text-xs font-mono text-slate-400 border border-white/5 space-y-1">
                      <div className="flex justify-between items-center text-[10px] border-b border-white/5 pb-1 mb-1 text-slate-500">
                        <span>ACTIVE STREAMS</span>
                        <span className="animate-pulse">● PROCESSING</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <ChevronRight size={10} className="text-emerald-400" />
                        <span>Initializing neural core layers...</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <ChevronRight size={10} className="text-emerald-400" />
                        <span>Evaluating mathematical parameters & wiki tokens...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Inactive state pre-seed dynamic triggers */}
            {messages.length === 1 && !isThinking && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 shrink-0">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.text)}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left text-xs text-slate-300 hover:text-white transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2 text-sky-400 font-bold mb-1.5">
                      <p.icon size={12} />
                      <span>Suggestion</span>
                    </div>
                    {p.text}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input Field Container */}
            <div className="relative shrink-0 mt-auto">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask PetnanAI anything..."
                className="w-full h-16 bg-white/10 border border-white/20 rounded-2xl pl-6 pr-24 text-base backdrop-blur-md focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 text-white placeholder-slate-400 transition-all"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isThinking}
                className="absolute right-3 top-3 bottom-3 px-6 bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-500 text-slate-950 font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>ASK</span>
                <Send size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Interactive Calculator, AI Synthesizer & System Telemetry (3 cols on lg) */}
        <section className="lg:col-span-3 flex flex-col gap-4 h-full lg:min-h-0 min-h-[450px]">
          
          {/* Dual Tab Switcher */}
          <div className="flex bg-slate-950/60 p-1 rounded-2xl border border-white/10 shrink-0">
            <button
              id="btn-tab-calculator"
              onClick={() => setRightActiveTab("calculator")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                rightActiveTab === "calculator"
                  ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 shadow-md shadow-yellow-400/5"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calculator size={13} />
              <span>Calculator</span>
            </button>
            <button
              id="btn-tab-synthesizer"
              onClick={() => setRightActiveTab("synthesizer")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                rightActiveTab === "synthesizer"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/5"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles size={13} />
              <span>AI Synthesizer</span>
            </button>
          </div>

          {rightActiveTab === "calculator" ? (
            /* Neural Calculator Widget */
            <div id="neural-calculator-panel" className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col shadow-2xl relative">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2 text-yellow-300 font-bold uppercase text-xs tracking-wider">
                  <Calculator size={16} className="text-yellow-300" />
                  Neural Calculator
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-mono px-1.5 py-0.5 rounded bg-white/5">Math.js Engine</span>
              </div>

              {/* Screen readout */}
              <div className="bg-slate-950/80 rounded-xl p-3 mb-3 border border-white/5 text-right font-mono shrink-0">
                <div className="text-xs text-slate-400 mb-1 overflow-x-auto whitespace-nowrap min-h-[16px]">
                  {calcDisplay || "0"}
                </div>
                <div className="text-xl font-bold text-white truncate min-h-[28px]">
                  {calcResult || "—"}
                </div>
              </div>

              {/* Scientific keys grid */}
              <div className="grid grid-cols-4 gap-1.5 shrink-0">
                {/* Row 1 */}
                <button onClick={() => handleCalcKeyPress("C")} className="h-9 flex items-center justify-center bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-400 transition-colors">C</button>
                <button onClick={() => handleCalcKeyPress("(")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">(</button>
                <button onClick={() => handleCalcKeyPress(")")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">)</button>
                <button onClick={() => handleCalcKeyPress("Del")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-colors">
                  <Delete size={14} />
                </button>

                {/* Row 2 */}
                <button onClick={() => handleCalcKeyPress("sin(")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono transition-colors">sin</button>
                <button onClick={() => handleCalcKeyPress("cos(")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono transition-colors">cos</button>
                <button onClick={() => handleCalcKeyPress("tan(")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono transition-colors">tan</button>
                <button onClick={() => handleCalcKeyPress("/")} className="h-9 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-colors">/</button>

                {/* Row 3 */}
                <button onClick={() => handleCalcKeyPress("7")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">7</button>
                <button onClick={() => handleCalcKeyPress("8")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">8</button>
                <button onClick={() => handleCalcKeyPress("9")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">9</button>
                <button onClick={() => handleCalcKeyPress("*")} className="h-9 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-colors">*</button>

                {/* Row 4 */}
                <button onClick={() => handleCalcKeyPress("4")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">4</button>
                <button onClick={() => handleCalcKeyPress("5")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">5</button>
                <button onClick={() => handleCalcKeyPress("6")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">6</button>
                <button onClick={() => handleCalcKeyPress("-")} className="h-9 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-colors">-</button>

                {/* Row 5 */}
                <button onClick={() => handleCalcKeyPress("1")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">1</button>
                <button onClick={() => handleCalcKeyPress("2")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">2</button>
                <button onClick={() => handleCalcKeyPress("3")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">3</button>
                <button onClick={() => handleCalcKeyPress("+")} className="h-9 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-colors">+</button>

                {/* Row 6 */}
                <button onClick={() => handleCalcKeyPress("sqrt(")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono transition-colors">sqrt</button>
                <button onClick={() => handleCalcKeyPress("0")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">0</button>
                <button onClick={() => handleCalcKeyPress("^")} className="h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono transition-colors">^</button>
                <button onClick={() => handleCalcKeyPress("=")} className="h-9 flex items-center justify-center bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 rounded-lg text-xs font-black transition-transform active:scale-95">=</button>
              </div>

              {/* Send to chat & math suggestions */}
              {calcResult && calcResult !== "Error" && (
                <div className="mt-3 flex gap-2 shrink-0 animate-fadeIn">
                  <button
                    onClick={() => {
                      setInputValue((prev) => `${prev} ${calcResult}`);
                    }}
                    className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold transition-all text-center"
                  >
                    Insert Result
                  </button>
                  <button
                    onClick={() => {
                      handleSendMessage(`Explain the steps of calculating: "${calcDisplay}". The result is ${calcResult}.`);
                    }}
                    className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl text-xs text-sky-400 font-bold transition-all text-center"
                  >
                    Explain Steps
                  </button>
                </div>
              )}

              {/* Calculations history logs */}
              <div className="mt-4 pt-3 border-t border-white/5 shrink-0">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1 mb-2">
                  <History size={10} /> Math Session History
                </span>
                <div className="space-y-1.5 overflow-y-auto max-h-[85px] pr-1">
                  {calcHistory.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const expr = h.split("=")[0].trim();
                        setCalcDisplay(expr);
                        setCalcResult(h.split("=")[1].trim());
                      }}
                      className="w-full text-left p-1.5 bg-slate-950/40 hover:bg-slate-950/80 rounded border border-white/5 hover:border-white/10 text-[10px] font-mono text-slate-300 flex items-center justify-between gap-2 truncate transition-colors"
                    >
                      <span className="truncate">{h.split("=")[0]}</span>
                      <span className="text-emerald-400 font-bold">{h.split("=")[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Neural Media Synthesizer Widget */
            <div id="media-synthesizer-panel" className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col shadow-2xl relative overflow-hidden flex-1 min-h-0">
              
              {/* Hidden Canvas and Audio elements for rendering */}
              <canvas ref={videoCanvasRef} width={600} height={400} className="hidden" />
              {synthesizedMusic && (
                <audio
                  ref={audioPlayerRef}
                  src={synthesizedMusic}
                  onPlay={() => setMusicPlaying(true)}
                  onPause={() => setMusicPlaying(false)}
                  onEnded={() => setMusicPlaying(false)}
                  className="hidden"
                />
              )}

              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2 text-purple-300 font-bold uppercase text-xs tracking-wider">
                  <Sparkles size={16} className="text-purple-300 animate-pulse" />
                  Media Synthesizer
                </div>
                <span className="text-[9px] text-emerald-400 uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20">Active Core</span>
              </div>

              <p className="text-[11px] text-slate-300 mb-4 leading-relaxed">
                Synthesize high-fidelity abstract artwork, custom 10-second soundtracks, or full-motion high-framerate videos.
              </p>

              {/* Generation Type Selector Buttons */}
              <div className="grid grid-cols-3 gap-1.5 mb-4 shrink-0">
                {[
                  { id: "image", label: "Image", icon: ImageIcon, colorClass: "text-emerald-400 hover:text-emerald-300" },
                  { id: "music", label: "Music", icon: Music, colorClass: "text-purple-400 hover:text-purple-300" },
                  { id: "video", label: "Video", icon: Video, colorClass: "text-sky-400 hover:text-sky-300" }
                ].map((tab) => {
                  const isActive = synthType === tab.id;
                  return (
                    <button
                      id={`btn-synth-type-${tab.id}`}
                      key={tab.id}
                      onClick={() => setSynthType(tab.id as any)}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-bold ${
                        isActive
                          ? "bg-white/10 border-white/20 text-white shadow-inner"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10"
                      }`}
                    >
                      <tab.icon size={14} className={tab.colorClass} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Prompt Textarea */}
              <div className="mb-4 shrink-0">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 font-mono">
                  ENTER GENERATION DIRECTIVE:
                </label>
                <textarea
                  id="synth-prompt-textarea"
                  value={synthPrompt}
                  onChange={(e) => setSynthPrompt(e.target.value)}
                  placeholder={
                    synthType === "image"
                      ? "e.g. Glowing mathematical fractal spirals..."
                      : synthType === "music"
                      ? "e.g. Cosmic deep ambient sci-fi drone..."
                      : "e.g. Cyberspace grid falling digital rain..."
                  }
                  rows={2}
                  className="w-full bg-slate-950/60 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 text-white placeholder-slate-600 resize-none transition-all font-sans"
                />
              </div>

              {/* Synthesis trigger button & Progress bar */}
              <div className="mb-4 shrink-0">
                {isSynthesizing ? (
                  <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-3 animate-pulse">
                    <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-purple-400 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin text-purple-400" />
                        synthesizing bytes...
                      </span>
                      <span>{synthProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${synthProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    id="btn-trigger-synthesis"
                    onClick={handleSynthesis}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 via-sky-400 to-purple-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    <span>SYNTHESIZE {synthType.toUpperCase()}</span>
                  </button>
                )}
              </div>

              {/* OUTPUT PREVIEW AREA */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[160px] scrollbar-thin">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1 border-b border-white/5 pb-1 mb-2">
                  <span>PREVIEW MATRIX</span>
                </div>

                {synthType === "image" && (
                  <div className="flex flex-col items-center justify-center h-full">
                    {synthesizedImage ? (
                      <div className="space-y-3 w-full animate-fadeIn">
                        <div className="aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shadow-lg relative group">
                          <img
                            id="preview-img-element"
                            src={synthesizedImage}
                            alt="Synthesized digital wallpaper"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a
                              href={synthesizedImage}
                              download={`petnan_ai_${Date.now()}.png`}
                              className="p-2.5 bg-slate-900 hover:bg-emerald-500 text-white hover:text-slate-950 rounded-xl border border-white/10 transition-all font-bold text-xs flex items-center gap-1.5 shadow-xl"
                            >
                              <Download size={13} />
                              Download PNG
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={synthesizedImage}
                            download={`petnan_ai_image_${Date.now()}.png`}
                            className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/30 rounded-xl text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            <Download size={13} /> Download
                          </a>
                          <button
                            id="btn-feed-image-to-chat"
                            onClick={() => {
                              handleSendMessage(`I generated a gorgeous procedural image with prompt: "${synthPrompt}". Can you analyze this concept and explain the mathematical visual patterns?`);
                            }}
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            Feed to Chat
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-2xl bg-slate-950/30 text-center px-4">
                        <ImageIcon size={32} className="text-slate-600 mb-2 animate-pulse" />
                        <p className="text-[11px] text-slate-500 leading-normal">
                          No synthesized image yet.<br />Submit a prompt to draw high-resolution PNG graphics!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {synthType === "music" && (
                  <div className="flex flex-col items-center justify-center h-full">
                    {synthesizedMusic ? (
                      <div className="space-y-3 w-full animate-fadeIn">
                        <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-lg flex flex-col items-center gap-3 relative overflow-hidden">
                          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/5 blur-xl rounded-full" />
                          
                          {/* Visualizer animation when playing */}
                          <div className="flex items-end justify-center gap-1 h-8 w-full mt-1">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 bg-gradient-to-t from-purple-500 to-sky-400 rounded-full transition-all duration-150`}
                                style={{
                                  height: musicPlaying 
                                    ? `${Math.max(15, Math.sin(i * 1.5 + Date.now() * 0.01) * 85 + 15)}%` 
                                    : "15%"
                                }}
                              />
                            ))}
                          </div>

                          <div className="text-center">
                            <p className="text-xs font-bold text-white font-mono truncate max-w-[200px]">
                              petnan_synthesizer_core_out.wav
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              10 SECONDS // STEREO CD-QUALITY PCM
                            </p>
                          </div>

                          <div className="flex gap-2 w-full mt-2">
                            <button
                              id="btn-play-synthesized-music"
                              onClick={() => {
                                if (audioPlayerRef.current) {
                                  if (musicPlaying) {
                                    audioPlayerRef.current.pause();
                                  } else {
                                    audioPlayerRef.current.play();
                                  }
                                }
                              }}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                musicPlaying
                                  ? "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                  : "bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/35"
                              }`}
                            >
                              {musicPlaying ? <Pause size={13} /> : <Play size={13} />}
                              <span>{musicPlaying ? "Pause Track" : "Play Preview"}</span>
                            </button>
                            
                            <a
                              href={synthesizedMusic}
                              download={`petnan_ai_audio_${Date.now()}.wav`}
                              className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center"
                              title="Download WAV Soundtrack"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <a
                            href={synthesizedMusic}
                            download={`petnan_ai_audio_${Date.now()}.wav`}
                            className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 hover:border-purple-500/30 rounded-xl text-xs text-purple-400 hover:text-purple-300 font-bold transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            <Download size={13} /> Download WAV
                          </a>
                          <button
                            id="btn-feed-music-to-chat"
                            onClick={() => {
                              handleSendMessage(`I generated a beautiful procedural audio track with prompt: "${synthPrompt}". Can you describe the physics of sound and synthesizers?`);
                            }}
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            Feed to Chat
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-2xl bg-slate-950/30 text-center px-4">
                        <Music size={32} className="text-slate-600 mb-2 animate-pulse" />
                        <p className="text-[11px] text-slate-500 leading-normal">
                          No synthesized music track yet.<br />Submit a prompt to build high-fidelity original stereo wav audio files!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {synthType === "video" && (
                  <div className="flex flex-col items-center justify-center h-full">
                    {synthesizedVideo ? (
                      <div className="space-y-3 w-full animate-fadeIn">
                        <div className="aspect-[3/2] w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shadow-lg relative group">
                          <video
                            id="preview-video-element"
                            src={synthesizedVideo}
                            controls
                            loop
                            autoPlay
                            muted
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={synthesizedVideo}
                            download={`petnan_ai_video_${Date.now()}.webm`}
                            className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 hover:border-sky-500/30 rounded-xl text-xs text-sky-400 hover:text-sky-300 font-bold transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            <Download size={13} /> Download Video
                          </a>
                          <button
                            id="btn-feed-video-to-chat"
                            onClick={() => {
                              handleSendMessage(`I generated a procedural animation video with prompt: "${synthPrompt}". Can you explain the animation mathematics behind canvas coordinate spaces and framerates?`);
                            }}
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            Feed to Chat
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-2xl bg-slate-950/30 text-center px-4">
                        <Video size={32} className="text-slate-600 mb-2 animate-pulse" />
                        <p className="text-[11px] text-slate-500 leading-normal">
                          No synthesized animation video yet.<br />Submit a prompt to record full-motion, high-framerate WebM video files!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statistics/System Health gauge panels */}
          <div className="flex-1 backdrop-blur-xl bg-purple-500/5 rounded-3xl border border-white/10 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <h4 className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Activity size={12} className="animate-pulse" /> Petnan Processing Telemetry
              </h4>
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-[10px] mb-1 font-semibold text-slate-300">
                    <span>COGNITIVE MATRIX DEPTH</span>
                    <span className="font-mono text-emerald-400">128-core Tensor</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full w-[85%] bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-1 font-semibold text-slate-300">
                    <span>MEMORY BUFFER</span>
                    <span className="font-mono text-purple-400">{memoryBuffer}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(192,132,252,0.4)]"
                      style={{ width: `${memoryBuffer}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-1 font-semibold text-slate-300">
                    <span>WIKIPEDIA SEMANTIC INDEX</span>
                    <span className="font-mono text-sky-400">{dataIndexed}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full w-[99.9%] bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.4)]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Helper hint */}
            <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed bg-slate-950/20 p-2 rounded-xl border border-white/5">
              <HelpCircle size={14} className="text-purple-400 shrink-0 mt-0.5" />
              <span>
                Use mathematical constants like <b>pi</b> or <b>e</b>, functions like <b>sqrt()</b>, or trigger complete word questions in the central neural chat frame.
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Wikipedia Extract Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/20 rounded-3xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative overflow-hidden">
            {/* Ambient subtle glow inside modal */}
            <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-sky-500/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0 relative z-10">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-sky-400" />
                <h2 className="text-xl font-bold text-white tracking-tight">{selectedArticle.title}</h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-sm px-3"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-slate-300 text-sm leading-relaxed space-y-4 pr-1 relative z-10 scrollbar-thin">
              <p className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 italic text-xs text-slate-400">
                Data extracted directly from the Wikipedia global archive matching the latest verified index.
              </p>
              <p className="whitespace-pre-line leading-relaxed">{selectedArticle.extract}</p>
            </div>

            <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-white/10 shrink-0 relative z-10">
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(selectedArticle.title)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-semibold"
              >
                View full original article <ExternalLink size={12} />
              </a>

              <button
                onClick={() => {
                  const title = selectedArticle.title;
                  const extractSnippet = selectedArticle.extract.slice(0, 800);
                  handleSendMessage(`Here is some information about "${title}" from Wikipedia: "${extractSnippet}". Use this context to answer my questions: Tell me more about "${title}".`);
                  setSelectedArticle(null);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-500 hover:scale-[1.02] text-slate-950 font-black rounded-xl transition-transform flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
              >
                <span>Feed to PetnanAI Chat</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer System Branding Info */}
      <footer className="relative z-10 flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 gap-3">
        <div>
          Powered by Petnan Unified Intelligence Architecture v4.0.2
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Terminal size={11} /> Shell Connected</span>
          <span className="flex items-center gap-1"><Brain size={11} /> 1.2M Parameters/sec</span>
          <span className="text-emerald-400 flex items-center gap-1">● ALL SYSTEMS OPERATIONAL</span>
        </div>
      </footer>
    </div>
  );
}
