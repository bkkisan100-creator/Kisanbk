"use client";

import { createClient } from "./lib/supabase/client";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type Bulletin = {
  id: number;
  title: string;
  summary?: string;
  script?: string;
  audio_url?: string;
  audio_file?: string;
  story_count?: number;
  published_at?: string;
  created_at?: string;
  like_count?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Panel =
  | "home"
  | "search"
  | "chat"
  | "alerts"
  | "profile";

type AuthMode = "login" | "signup";

const CHAT_STORAGE_KEY =
  "aaja-ke-chha-ai-chat-history";

const BACKGROUND_MUSIC =
  "https://ieuytrerprgrfqenxwsi.supabase.co/storage/v1/object/public/audio/background-music.wav";

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function shortTitle(title: string) {
  if (!title) return "";

  const clean = title.trim();

  if (clean.length <= 90) {
    return clean;
  }

  return `${clean.slice(0, 87)}...`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function formatPublishedTime(value?: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("ne-NP", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function getBulletinTime(value?: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("ne-NP", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function Home() {
  /*
   * ==================================================
   * SUPABASE CLIENT
   * ==================================================
   */

  const [supabase] = useState(() =>
    createClient()
  );

  /*
   * ==================================================
   * AUTH STATE
   * ==================================================
   */

  const [user, setUser] = useState<any>(null);

  const [profileName, setProfileName] =
    useState("");

  const [authMode, setAuthMode] =
    useState<AuthMode>("login");

  const [showAuth, setShowAuth] =
    useState(false);

  const [authEmail, setAuthEmail] =
    useState("");

  const [authPassword, setAuthPassword] =
    useState("");

  const [authName, setAuthName] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState("");

  const [authSuccess, setAuthSuccess] =
    useState("");

  /*
   * ==================================================
   * GENERAL STATE
   * ==================================================
   */

  const [showSplash, setShowSplash] =
    useState(true);

  const [bulletin, setBulletin] =
    useState<Bulletin | null>(null);

  const [history, setHistory] =
    useState<Bulletin[]>([]);

  const [loadingBulletin, setLoadingBulletin] =
    useState(true);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [panel, setPanel] =
    useState<Panel>("home");

  const [liked, setLiked] =
    useState(false);

  const [likeCount, setLikeCount] =
    useState(0);

  const [showComments, setShowComments] =
    useState(false);

  const [commentText, setCommentText] =
    useState("");

  const [comments, setComments] =
    useState<string[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<Bulletin[]>([]);

  const [searching, setSearching] =
    useState(false);

  const [audioPlaying, setAudioPlaying] =
    useState(false);

  const [audioCurrent, setAudioCurrent] =
    useState(0);

  const [audioDuration, setAudioDuration] =
    useState(0);

  const [selectedAudio, setSelectedAudio] =
    useState<Bulletin | null>(null);

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([]);

  const [chatInput, setChatInput] =
    useState("");

  const [chatLoading, setChatLoading] =
    useState(false);

  const chatEndRef =
    useRef<HTMLDivElement | null>(null);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const musicRef =
    useRef<HTMLAudioElement | null>(null);

  /*
   * ==================================================
   * AUTH - LOAD CURRENT SESSION
   * ==================================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUser() {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Session loading error:",
          error
        );
        return;
      }

      if (!mounted) return;

      const currentUser =
        data.session?.user || null;

      setUser(currentUser);

      if (currentUser) {
        await loadProfile(
          currentUser.id
        );
      }
    }

    loadCurrentUser();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          session
        ) => {
          if (!mounted) return;

          const currentUser =
            session?.user || null;

          setUser(currentUser);

          if (currentUser) {
            await loadProfile(
              currentUser.id
            );
          } else {
            setProfileName("");
          }
        }
      );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  /*
   * ==================================================
   * LOAD PROFILE
   * ==================================================
   */

  async function loadProfile(
    userId: string
  ) {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name"
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "Profile loading error:",
          error
        );
        return;
      }

      if (data?.full_name) {
        setProfileName(
          data.full_name
        );
      } else if (user?.email) {
        setProfileName(
          user.email.split("@")[0]
        );
      }
    } catch (error) {
      console.error(
        "Profile error:",
        error
      );
    }
  }

  /*
   * ==================================================
   * OPEN LOGIN
   * ==================================================
   */

  function openLogin() {
    setAuthMode("login");

    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");

    setAuthError("");
    setAuthSuccess("");

    setShowAuth(true);
  }

  /*
   * ==================================================
   * OPEN SIGNUP
   * ==================================================
   */

  function openSignup() {
    setAuthMode("signup");

    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");

    setAuthError("");
    setAuthSuccess("");

    setShowAuth(true);
  }

  /*
   * ==================================================
   * CLOSE AUTH
   * ==================================================
   */

  function closeAuth() {
    if (authLoading) return;

    setShowAuth(false);

    setAuthError("");
    setAuthSuccess("");
  }

  /*
   * ==================================================
   * LOGIN
   * ==================================================
   */

  async function handleLogin() {
    const email =
      authEmail.trim();

    const password =
      authPassword;

    setAuthError("");
    setAuthSuccess("");

    if (!email) {
      setAuthError(
        "Email राख्नुहोस्।"
      );
      return;
    }

    if (!password) {
      setAuthError(
        "Password राख्नुहोस्।"
      );
      return;
    }

    try {
      setAuthLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password,
          }
        );

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Login हुन सकेन। फेरि प्रयास गर्नुहोस्।"
        );
      }

      setUser(data.user);

      await loadProfile(
        data.user.id
      );

      setAuthSuccess(
        "Login सफल भयो।"
      );

      setAuthPassword("");

      setTimeout(() => {
        setShowAuth(false);
        setAuthSuccess("");
      }, 700);
    } catch (error: any) {
      console.error(
        "Login error:",
        error
      );

      setAuthError(
        error?.message ||
          "Login हुन सकेन। Email र password जाँच गर्नुहोस्।"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  /*
   * ==================================================
   * CREATE ACCOUNT
   * ==================================================
   */

  async function handleSignup() {
    const name =
      authName.trim();

    const email =
      authEmail.trim();

    const password =
      authPassword;

    setAuthError("");
    setAuthSuccess("");

    if (!name) {
      setAuthError(
        "तपाईंको नाम राख्नुहोस्।"
      );
      return;
    }

    if (!email) {
      setAuthError(
        "Email राख्नुहोस्।"
      );
      return;
    }

    if (password.length < 6) {
      setAuthError(
        "Password कम्तीमा 6 characters हुनुपर्छ।"
      );
      return;
    }

    try {
      setAuthLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Account create हुन सकेन।"
        );
      }

      /*
       * PROFILE TABLE
       */

      if (data.session) {
        const {
          error: profileError,
        } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            email: email,
            full_name: name,
          });

        if (profileError) {
          console.error(
            "Profile save error:",
            profileError
          );
        }

        setUser(data.user);
        setProfileName(name);

        setAuthSuccess(
          "Account सफलतापूर्वक बन्यो।"
        );

        setAuthPassword("");

        setTimeout(() => {
          setShowAuth(false);
          setAuthSuccess("");
        }, 900);
      } else {
        /*
         * EMAIL CONFIRMATION ENABLED भएमा
         */

        setAuthSuccess(
          "Account बन्यो। Email मा आएको confirmation link खोल्नुहोस्, त्यसपछि Login गर्नुहोस्।"
        );

        setAuthPassword("");
      }
    } catch (error: any) {
      console.error(
        "Signup error:",
        error
      );

      setAuthError(
        error?.message ||
          "Account create हुन सकेन। फेरि प्रयास गर्नुहोस्।"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  /*
   * ==================================================
   * AUTH FORM SUBMIT
   * ==================================================
   */

  async function handleAuthSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (authMode === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  }

  /*
   * ==================================================
   * LOGOUT
   * ==================================================
   */

  async function handleLogout() {
    try {
      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setUser(null);
      setProfileName("");

      setPanel("profile");
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      alert(
        "Logout हुन सकेन। फेरि प्रयास गर्नुहोस्।"
      );
    }
  }

  /*
   * ==================================================
   * MUSIC VOLUME
   * ==================================================
   */

  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume =
        0.007;
    }
  }, []);

  /*
   * ==================================================
   * SPLASH
   * ==================================================
   */

  useEffect(() => {
    const timer =
      setTimeout(() => {
        setShowSplash(false);
      }, 1800);

    return () =>
      clearTimeout(timer);
  }, []);

  /*
   * ==================================================
   * INITIAL DATA
   * ==================================================
   */

  useEffect(() => {
    loadBulletin();
    loadHistory();
  }, []);

  /*
   * ==================================================
   * AUTO REFRESH
   * ==================================================
   */

  useEffect(() => {
    if (showSplash) return;

    const timer =
      setInterval(() => {
        loadBulletin(true);
        loadHistory(true);
      }, 60000);

    return () =>
      clearInterval(timer);
  }, [showSplash]);

  /*
   * ==================================================
   * LOAD LATEST BULLETIN
   * ==================================================
   */

  async function loadBulletin(
    silent = false
  ) {
    try {
      if (!silent) {
        setLoadingBulletin(true);
      }

      const response =
        await fetch(
          "/api/news/bulletin/latest",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        data?.success &&
        data?.bulletin
      ) {
        const latest =
          data.bulletin as Bulletin;

        setBulletin(latest);

        setLikeCount(
          latest.like_count || 0
        );

        setSelectedAudio(
          (previous) => {
            if (!previous) {
              return latest;
            }

            if (
              previous.id ===
              latest.id
            ) {
              return latest;
            }

            return previous;
          }
        );
      }
    } catch (error) {
      console.error(
        "Bulletin loading error:",
        error
      );
    } finally {
      if (!silent) {
        setLoadingBulletin(false);
      }
    }
  }

  /*
   * ==================================================
   * LOAD HISTORY
   * ==================================================
   */

  async function loadHistory(
    silent = false
  ) {
    try {
      if (!silent) {
        setLoadingHistory(true);
      }

      const response =
        await fetch(
          "/api/news/bulletin/history",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        data?.success &&
        Array.isArray(
          data?.bulletins
        )
      ) {
        setHistory(
          data.bulletins
        );
      }
    } catch (error) {
      console.error(
        "Bulletin history error:",
        error
      );
    } finally {
      if (!silent) {
        setLoadingHistory(false);
      }
    }
  }

  /*
   * ==================================================
   * STOP EVERYTHING
   * ==================================================
   */

  function stopAllAudio() {
    const newsAudio =
      audioRef.current;

    const musicAudio =
      musicRef.current;

    if (newsAudio) {
      newsAudio.pause();
      newsAudio.currentTime = 0;
    }

    if (musicAudio) {
      musicAudio.pause();
      musicAudio.currentTime = 0;
    }

    setAudioPlaying(false);
    setAudioCurrent(0);
  }

  /*
   * ==================================================
   * START BACKGROUND MUSIC
   * ==================================================
   */

  async function startBackgroundMusic() {
    const music =
      musicRef.current;

    if (!music) return;

    try {
      music.volume = 0.005;
      music.currentTime = 0;

      await music.play();
    } catch (error) {
      console.warn(
        "Background music could not start:",
        error
      );
    }
  }

  /*
   * ==================================================
   * PAUSE BACKGROUND MUSIC
   * ==================================================
   */

  function pauseBackgroundMusic() {
    const music =
      musicRef.current;

    if (!music) return;

    music.pause();
  }

  /*
   * ==================================================
   * PLAY BULLETIN
   * ==================================================
   */

  async function playBulletin(
    item: Bulletin
  ) {
    if (!item.audio_url) {
      return;
    }

    const audio =
      audioRef.current;

    if (!audio) {
      return;
    }

    if (
      selectedAudio?.id ===
      item.id
    ) {
      if (audio.paused) {
        try {
          await audio.play();

          setAudioPlaying(true);

          const music =
            musicRef.current;

          if (music) {
            try {
              music.volume = 0.005;
              await music.play();
            } catch {}
          }
        } catch (error) {
          console.error(
            "Audio play error:",
            error
          );
        }
      } else {
        audio.pause();

        pauseBackgroundMusic();

        setAudioPlaying(false);
      }

      return;
    }

    stopAllAudio();

    setSelectedAudio(item);

    setAudioCurrent(0);
    setAudioDuration(0);

    setTimeout(
      async () => {
        const currentAudio =
          audioRef.current;

        if (!currentAudio) return;

        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;

          currentAudio.load();

          await new Promise<void>(
            (resolve) => {
              const handler =
                () => {
                  currentAudio.removeEventListener(
                    "canplay",
                    handler
                  );

                  resolve();
                };

              currentAudio.addEventListener(
                "canplay",
                handler
              );

              setTimeout(
                () => {
                  currentAudio.removeEventListener(
                    "canplay",
                    handler
                  );

                  resolve();
                },
                1000
              );
            }
          );

          await currentAudio.play();

          setAudioPlaying(true);

          await startBackgroundMusic();
        } catch (error) {
          console.error(
            "Selected audio play error:",
            error
          );

          setAudioPlaying(false);
          pauseBackgroundMusic();
        }
      },
      80
    );
  }

  /*
   * ==================================================
   * PLAY LATEST
   * ==================================================
   */

  async function playLatest() {
    if (!bulletin?.audio_url) {
      return;
    }

    await playBulletin(
      bulletin
    );
  }

  /*
   * ==================================================
   * AUDIO TOGGLE
   * ==================================================
   */

  async function toggleAudio() {
    const audio =
      audioRef.current;

    if (
      !audio ||
      !selectedAudio
    ) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();

        setAudioPlaying(true);

        const music =
          musicRef.current;

        if (music) {
          try {
            music.volume = 0.005;
            await music.play();
          } catch {}
        }
      } catch (error) {
        console.error(
          "Audio play error:",
          error
        );
      }
    } else {
      audio.pause();

      pauseBackgroundMusic();

      setAudioPlaying(false);
    }
  }

  /*
   * ==================================================
   * AUDIO TIME UPDATE
   * ==================================================
   */

  function handleAudioTimeUpdate() {
    const audio =
      audioRef.current;

    if (!audio) return;

    setAudioCurrent(
      audio.currentTime
    );
  }

  /*
   * ==================================================
   * AUDIO METADATA
   * ==================================================
   */

  function handleAudioLoadedMetadata() {
    const audio =
      audioRef.current;

    if (!audio) return;

    setAudioDuration(
      audio.duration || 0
    );
  }

  /*
   * ==================================================
   * AUDIO ENDED
   * ==================================================
   */

  function handleAudioEnded() {
    const audio =
      audioRef.current;

    const music =
      musicRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (music) {
      music.pause();
      music.currentTime = 0;
    }

    setAudioPlaying(false);
    setAudioCurrent(0);
  }

  /*
   * ==================================================
   * AUDIO SEEK
   * ==================================================
   */

  function handleAudioSeek(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const value =
      Number(event.target.value);

    setAudioCurrent(value);

    if (audioRef.current) {
      audioRef.current.currentTime =
        value;
    }
  }

  /*
   * ==================================================
   * CHAT HISTORY
   * ==================================================
   */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          CHAT_STORAGE_KEY
        );

      if (saved) {
        const parsed =
          JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setChatMessages(
            parsed
          );

          return;
        }
      }

      setChatMessages([
        {
          id: makeId(),
          role: "assistant",
          text:
            "नमस्कार 👋 म आज के छ? को AI Assistant हुँ। समाचार मात्र होइन, जुनसुकै विषयमा मसँग कुरा गर्न सक्नुहुन्छ।",
        },
      ]);
    } catch (error) {
      console.error(
        "Chat history loading error:",
        error
      );

      setChatMessages([
        {
          id: makeId(),
          role: "assistant",
          text:
            "नमस्कार 👋 आज के छ? मा स्वागत छ। जुनसुकै विषयमा मसँग कुरा गर्न सक्नुहुन्छ।",
        },
      ]);
    }
  }, []);

  /*
   * ==================================================
   * SAVE CHAT
   * ==================================================
   */

  useEffect(() => {
    if (!chatMessages.length)
      return;

    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(
          chatMessages
        )
      );
    } catch (error) {
      console.error(
        "Chat history save error:",
        error
      );
    }
  }, [chatMessages]);

  /*
   * ==================================================
   * CHAT SCROLL
   * ==================================================
   */

  useEffect(() => {
    if (panel !== "chat")
      return;

    const timer =
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView(
          {
            behavior: "smooth",
            block: "end",
          }
        );
      }, 50);

    return () =>
      clearTimeout(timer);
  }, [
    chatMessages,
    chatLoading,
    panel,
  ]);

  /*
   * ==================================================
   * NEW CHAT
   * ==================================================
   */

  function startNewChat() {
    const firstMessage:
      ChatMessage = {
      id: makeId(),
      role: "assistant",
      text:
        "नयाँ chat सुरु भयो 👋 अब के कुरा गरौँ?",
    };

    setChatMessages([
      firstMessage,
    ]);

    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify([
          firstMessage,
        ])
      );
    } catch (error) {
      console.error(
        "New chat storage error:",
        error
      );
    }
  }

  /*
   * ==================================================
   * SEND CHAT
   * ==================================================
   */

  async function sendChatMessage() {
    const message =
      chatInput.trim();

    if (
      !message ||
      chatLoading
    ) {
      return;
    }

    const userMessage:
      ChatMessage = {
      id: makeId(),
      role: "user",
      text: message,
    };

    const updatedMessages = [
      ...chatMessages,
      userMessage,
    ];

    setChatMessages(
      updatedMessages
    );

    setChatInput("");
    setChatLoading(true);

    try {
      const chatHistory =
        updatedMessages
          .slice(-12)
          .map((item) => ({
            role: item.role,
            text: item.text,
          }));

      const response =
        await fetch(
          "/api/ai/chat",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              message,
              history:
                chatHistory,
              news: bulletin
                ? {
                    title:
                      bulletin.title,
                    summary:
                      bulletin.summary ||
                      "",
                  }
                : null,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "AI response failed"
        );
      }

      const assistantMessage:
        ChatMessage = {
        id: makeId(),
        role: "assistant",
        text:
          data.reply ||
          "माफ गर्नुहोस्, अहिले उत्तर दिन सकिनँ।",
      };

      setChatMessages(
        (previous) => [
          ...previous,
          assistantMessage,
        ]
      );
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      setChatMessages(
        (previous) => [
          ...previous,
          {
            id: makeId(),
            role: "assistant",
            text:
              "माफ गर्नुहोस्, अहिले AI सँग connection हुन सकेन। केही बेरपछि फेरि प्रयास गर्नुहोस्।",
          },
        ]
      );
    } finally {
      setChatLoading(false);
    }
  }

  /*
   * ==================================================
   * CHAT KEYBOARD
   * ==================================================
   */

  function handleChatKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  /*
   * ==================================================
   * LIKE
   * ==================================================
   */

  async function toggleLike() {
    if (!bulletin) return;

    const nextLiked =
      !liked;

    setLiked(nextLiked);

    setLikeCount(
      (count) =>
        nextLiked
          ? count + 1
          : Math.max(
              0,
              count - 1
            )
    );

    try {
      await fetch(
        "/api/bulletin/like",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            bulletin_id:
              bulletin.id,
            liked:
              nextLiked,
          }),
        }
      );
    } catch (error) {
      console.error(
        "Like error:",
        error
      );
    }
  }

  /*
   * ==================================================
   * SHARE
   * ==================================================
   */

  async function shareNews() {
    const title =
      bulletin?.title ||
      "आज के छ?";

    const shareData = {
      title: "आज के छ?",
      text: title,
      url:
        window.location.href,
    };

    try {
      if (
        typeof navigator !==
          "undefined" &&
        navigator.share
      ) {
        await navigator.share(
          shareData
        );
      } else {
        await navigator.clipboard.writeText(
          `${title}\n${window.location.href}`
        );

        alert(
          "Link copied!"
        );
      }
    } catch (error) {
      console.error(
        "Share error:",
        error
      );
    }
  }

  /*
   * ==================================================
   * COMMENTS
   * ==================================================
   */

  function addComment() {
    const value =
      commentText.trim();

    if (!value) return;

    setComments(
      (previous) => [
        ...previous,
        value,
      ]
    );

    setCommentText("");
  }

  /*
   * ==================================================
   * SEARCH
   * ==================================================
   */

  async function performSearch() {
    const query =
      searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);

      const response =
        await fetch(
          `/api/news/search?q=${encodeURIComponent(
            query
          )}`
        );

      const data =
        await response.json();

      if (data?.success) {
        setSearchResults(
          data.news || []
        );
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  /*
   * ==================================================
   * SPLASH
   * ==================================================
   */

  if (showSplash) {
    return (
      <main className="splash-screen">
        <img
          src="/logo.png"
          alt="आज के छ?"
          className="splash-logo"
        />
      </main>
    );
  }

  /*
   * ==================================================
   * MAIN APP
   * ==================================================
   */

  return (
    <main className="app-shell">

      {/* NEWS AUDIO */}
      {selectedAudio?.audio_url && (
        <audio
          ref={audioRef}
          src={
            selectedAudio.audio_url
          }
          preload="metadata"
          onTimeUpdate={
            handleAudioTimeUpdate
          }
          onLoadedMetadata={
            handleAudioLoadedMetadata
          }
          onEnded={
            handleAudioEnded
          }
        />
      )}

      {/* BACKGROUND MUSIC */}
      <audio
        ref={musicRef}
        src={BACKGROUND_MUSIC}
        preload="auto"
        loop
      />

      {/* ==================================================
          HOME
          ================================================== */}

      {panel === "home" && (
        <section className="home-screen">

          <div className="news-background">
            <div className="background-glow glow-one" />
            <div className="background-glow glow-two" />
            <div className="background-grid" />
          </div>

          {/* HEADER */}
          <header className="top-header">

            <div className="header-spacer" />

            <button
              className="icon-button notification-button"
              onClick={() =>
                setPanel("alerts")
              }
              aria-label="Notifications"
            >
              <span>🔔</span>
              <b>3</b>
            </button>

          </header>

          {/* LIVE */}
          <div className="live-pill">
            <span className="live-dot" />
            LIVE NEWS
          </div>

          {/* NEWS PHOTO */}
          <div className="news-photo-card">

            <img
              src="/news-photo.jpg"
              alt="Live News"
              className="news-photo"
            />

          </div>

          {/* NEWS CONTENT */}
          <div className="news-content">

            {loadingBulletin ? (
              <div className="loading-news">

                <div className="loading-circle" />

                <p>
                  समाचार तयार हुँदैछ...
                </p>

              </div>
            ) : bulletin ? (
              <>

                <div className="news-meta">

                  <span>
                    {formatPublishedTime(
                      bulletin.published_at
                    )}
                  </span>

                </div>

                <h1 className="news-headline">
                  {shortTitle(
                    bulletin.title
                  )}
                </h1>

                {bulletin.summary && (
                  <p className="news-summary">
                    {
                      bulletin.summary
                    }
                  </p>
                )}

              </>
            ) : (
              <div className="loading-news">

                <p>
                  अहिले bulletin उपलब्ध छैन।
                </p>

              </div>
            )}

          </div>

          {/* RIGHT ACTIONS */}
          <aside className="right-actions">

            <button
              className={`action-button ${
                liked
                  ? "active"
                  : ""
              }`}
              onClick={
                toggleLike
              }
            >

              <span className="action-icon">
                {liked
                  ? "❤️"
                  : "🤍"}
              </span>

              <small>
                {likeCount}
              </small>

            </button>

            <button
              className="action-button"
              onClick={() =>
                setShowComments(
                  true
                )
              }
            >

              <span className="action-icon">
                💬
              </span>

              <small>
                {comments.length}
              </small>

            </button>

            <button
              className="action-button"
              onClick={
                shareNews
              }
            >

              <span className="action-icon">
                ↗
              </span>

              <small>
                Share
              </small>

            </button>

          </aside>

          {/* AUDIO BULLETIN */}
          {selectedAudio?.audio_url && (
            <div className="audio-dock">

              <div className="audio-top">

                <button
                  className={`play-button ${
                    audioPlaying
                      ? "playing"
                      : ""
                  }`}
                  onClick={
                    toggleAudio
                  }
                  aria-label={
                    audioPlaying
                      ? "Pause audio"
                      : "Play audio"
                  }
                >
                  {audioPlaying
                    ? "Ⅱ"
                    : "▶"}
                </button>

                <div className="audio-info">

                  <div className="audio-title">
                    आजका{" "}
                    {selectedAudio.story_count ||
                      12}{" "}
                    प्रमुख समाचार
                  </div>

                  <div className="audio-subtitle">
                    AI Audio Bulletin
                  </div>

                </div>

                <div
                  className={`wave ${
                    audioPlaying
                      ? "wave-active"
                      : ""
                  }`}
                >

                  {Array.from({
                    length: 38,
                  }).map(
                    (_, index) => (
                      <span
                        key={
                          index
                        }
                        className={
                          audioPlaying
                            ? "wave-bar playing"
                            : "wave-bar"
                        }
                        style={{
                          animationDelay:
                            `${
                              index *
                              0.035
                            }s`,
                        }}
                      />
                    )
                  )}

                </div>

              </div>

              {/* PROGRESS */}
              <div className="audio-progress-row">

                <span>
                  {formatTime(
                    audioCurrent
                  )}
                </span>

                <input
                  type="range"
                  min="0"
                  max={
                    audioDuration >
                    0
                      ? audioDuration
                      : 0
                  }
                  step="0.1"
                  value={
                    audioDuration >
                    0
                      ? Math.min(
                          audioCurrent,
                          audioDuration
                        )
                      : 0
                  }
                  onChange={
                    handleAudioSeek
                  }
                  className="audio-range"
                />

                <span>
                  {formatTime(
                    audioDuration
                  )}
                </span>

              </div>

              <div className="audio-bottom-info">

                <span>
                  ● हरेक घण्टा नयाँ bulletin
                </span>

                <span>
                  {formatPublishedTime(
                    selectedAudio.published_at
                  )}
                </span>

              </div>

            </div>
          )}

          {/* PREVIOUS BULLETINS */}
          {history.length > 1 && (
            <div className="previous-bulletins">

              <div className="previous-header">

                <div>

                  <strong>
                    Previous Bulletins
                  </strong>

                  <span>
                    पुरानो audio
                  </span>

                </div>

                {loadingHistory && (
                  <small>
                    अपडेट हुँदैछ...
                  </small>
                )}

              </div>

              <div className="previous-list">

                {history
                  .filter(
                    (item) =>
                      item.id !==
                      bulletin?.id
                  )
                  .map(
                    (item) => (
                      <button
                        key={
                          item.id
                        }
                        className={`previous-item ${
                          selectedAudio?.id ===
                          item.id
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          playBulletin(
                            item
                          )
                        }
                      >

                        <div className="previous-play">

                          {selectedAudio?.id ===
                            item.id &&
                          audioPlaying
                            ? "Ⅱ"
                            : "▶"}

                        </div>

                        <div className="previous-info">

                          <strong>
                            {shortTitle(
                              item.title
                            )}
                          </strong>

                          <span>
                            {getBulletinTime(
                              item.published_at ||
                                item.created_at
                            )}
                          </span>

                        </div>

                        <div className="previous-arrow">
                          →
                        </div>

                      </button>
                    )
                  )}

              </div>

            </div>
          )}

          {/* BOTTOM NAV */}
          <nav className="bottom-nav">

            <button
              className="nav-item active"
              onClick={() =>
                setPanel("home")
              }
            >

              <span>⌂</span>

              <small>
                Home
              </small>

            </button>

            <button
              className="nav-item"
              onClick={() =>
                setPanel("search")
              }
            >

              <span>⌕</span>

              <small>
                Search
              </small>

            </button>

            <button
              className="ai-nav-button"
              onClick={() =>
                setPanel("chat")
              }
            >

              <span>
                AI
              </span>

            </button>

            <button
              className="nav-item"
              onClick={() =>
                setPanel("alerts")
              }
            >

              <span>♢</span>

              <small>
                Alerts
              </small>

            </button>

            <button
              className="nav-item"
              onClick={() =>
                setPanel("profile")
              }
            >

              <span>◯</span>

              <small>
                Profile
              </small>

            </button>

          </nav>

        </section>
      )}

      {/* ==================================================
          SEARCH
          ================================================== */}

      {panel === "search" && (
        <section className="full-panel">

          <header className="panel-header">

            <button
              className="back-button"
              onClick={() =>
                setPanel("home")
              }
            >
              ←
            </button>

            <h2>
              Search
            </h2>

            <div />

          </header>

          <div className="search-box">

            <span>
              ⌕
            </span>

            <input
              value={
                searchQuery
              }
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  performSearch();
                }
              }}
              placeholder="समाचार खोज्नुहोस्..."
              autoFocus
            />

            <button
              onClick={
                performSearch
              }
            >
              खोज
            </button>

          </div>

          <div className="search-results">

            {searching && (
              <div className="empty-state">
                खोज्दै...
              </div>
            )}

            {!searching &&
              searchQuery &&
              searchResults.length ===
                0 && (
                <div className="empty-state">
                  कुनै समाचार भेटिएन।
                </div>
              )}

            {searchResults.map(
              (item) => (
                <article
                  key={item.id}
                  className="search-card"
                >

                  <div className="search-card-meta">
                    {formatPublishedTime(
                      item.published_at
                    )}
                  </div>

                  <h3>
                    {item.title}
                  </h3>

                  {item.summary && (
                    <p>
                      {
                        item.summary
                      }
                    </p>
                  )}

                </article>
              )
            )}

          </div>

          <div className="panel-bottom-nav">

            <button
              onClick={() =>
                setPanel("home")
              }
            >
              Home
            </button>

            <button className="selected">
              Search
            </button>

            <button
              onClick={() =>
                setPanel("chat")
              }
            >
              AI Chat
            </button>

          </div>

        </section>
      )}

      {/* ==================================================
          CHAT
          ================================================== */}

      {panel === "chat" && (
        <section className="chat-screen">

          <header className="chat-header">

            <button
              className="chat-back"
              onClick={() =>
                setPanel("home")
              }
            >
              ←
            </button>

            <div className="chat-brand">

              <div className="chat-ai-icon">
                AI
              </div>

              <div>

                <strong>
                  आज के छ? AI
                </strong>

                <small>
                  General AI Assistant
                </small>

              </div>

            </div>

            <button
              className="new-chat-button"
              onClick={
                startNewChat
              }
              title="New Chat"
            >
              ＋
            </button>

          </header>

          <div className="chat-history">

            {chatMessages.map(
              (message) => (
                <div
                  key={
                    message.id
                  }
                  className={`chat-row ${
                    message.role ===
                    "user"
                      ? "user-row"
                      : "assistant-row"
                  }`}
                >

                  {message.role ===
                    "assistant" && (
                    <div className="message-avatar">
                      AI
                    </div>
                  )}

                  <div
                    className={`chat-bubble ${
                      message.role ===
                      "user"
                        ? "user-bubble"
                        : "assistant-bubble"
                    }`}
                  >
                    {message.text
                      .split("\n")
                      .map(
                        (
                          line,
                          index
                        ) => (
                          <span
                            key={
                              index
                            }
                          >
                            {line}

                            {index <
                              message.text.split(
                                "\n"
                              ).length -
                                1 && (
                              <br />
                            )}
                          </span>
                        )
                      )}
                  </div>

                  {message.role ===
                    "user" && (
                    <div className="message-avatar user-avatar">
                      You
                    </div>
                  )}

                </div>
              )
            )}

            {chatLoading && (
              <div className="chat-row assistant-row">

                <div className="message-avatar">
                  AI
                </div>

                <div className="typing-bubble">
                  <span />
                  <span />
                  <span />
                </div>

              </div>
            )}

            <div
              ref={chatEndRef}
            />

          </div>

          <div className="chat-composer">

            <textarea
              value={
                chatInput
              }
              onChange={(event) =>
                setChatInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleChatKeyDown
              }
              placeholder="जे सोध्न मन लाग्छ सोध्नुहोस्..."
              rows={1}
              disabled={
                chatLoading
              }
            />

            <button
              className="send-button"
              onClick={
                sendChatMessage
              }
              disabled={
                !chatInput.trim() ||
                chatLoading
              }
            >
              ↑
            </button>

          </div>

          <div className="chat-hint">
            AI ले गल्ती गर्न सक्छ।
            महत्वपूर्ण जानकारी verify गर्नुहोस्।
          </div>

        </section>
      )}

      {/* ==================================================
          ALERTS
          ================================================== */}

      {panel === "alerts" && (
        <section className="full-panel">

          <header className="panel-header">

            <button
              className="back-button"
              onClick={() =>
                setPanel("home")
              }
            >
              ←
            </button>

            <h2>
              Notifications
            </h2>

            <button className="clear-button">
              Clear
            </button>

          </header>

          <div className="notification-list">

            <div className="notification-card unread">

              <div className="notification-icon">
                🔴
              </div>

              <div>

                <strong>
                  नयाँ समाचार bulletin तयार भयो
                </strong>

                <p>
                  आजको नयाँ AI audio bulletin सुन्नुहोस्।
                </p>

                <small>
                  केही समय अघि
                </small>

              </div>

            </div>

            <div className="notification-card">

              <div className="notification-icon">
                🤖
              </div>

              <div>

                <strong>
                  AI Chat उपलब्ध छ
                </strong>

                <p>
                  जुनसुकै विषयमा AI सँग कुरा गर्नुहोस्।
                </p>

                <small>
                  आज
                </small>

              </div>

            </div>

          </div>

          <div className="panel-bottom-nav">

            <button
              onClick={() =>
                setPanel("home")
              }
            >
              Home
            </button>

            <button
              onClick={() =>
                setPanel("chat")
              }
            >
              AI Chat
            </button>

            <button className="selected">
              Alerts
            </button>

          </div>

        </section>
      )}

      {/* ==================================================
          PROFILE
          ================================================== */}

      {panel === "profile" && (
        <section className="full-panel">

          <header className="panel-header">

            <button
              className="back-button"
              onClick={() =>
                setPanel("home")
              }
            >
              ←
            </button>

            <h2>
              Profile
            </h2>

            <div />

          </header>

          <div className="profile-content">

            <div className="profile-avatar">
              {user
                ? (
                    profileName ||
                    user.email ||
                    "आ"
                  )
                    .charAt(0)
                    .toUpperCase()
                : "आ"}
            </div>

            <h2>
              {user
                ? profileName ||
                  "आज के छ? User"
                : "आज के छ?"}
            </h2>

            <p>
              {user
                ? user.email
                : "AI-powered Nepali News"}
            </p>

            {/* =========================================
                LOGGED IN
                ========================================= */}

            {user ? (
              <>

                <div className="profile-card">

                  <div>
                    <span>
                      Account
                    </span>

                    <strong>
                      Logged in
                    </strong>
                  </div>

                  <div>
                    <span>
                      Language
                    </span>

                    <strong>
                      नेपाली
                    </strong>
                  </div>

                  <div>
                    <span>
                      AI Assistant
                    </span>

                    <strong>
                      Gemini AI
                    </strong>
                  </div>

                  <div>
                    <span>
                      News
                    </span>

                    <strong>
                      AI Audio Bulletin
                    </strong>
                  </div>

                </div>

                <button
                  className="profile-auth-button logout-button"
                  onClick={
                    handleLogout
                  }
                >
                  🚪 Logout
                </button>

              </>
            ) : (
              /* =========================================
                 LOGGED OUT
                 ========================================= */

              <div className="profile-auth-box">

                <p className="profile-login-text">
                  Account बनाएर आफ्नो profile सुरक्षित राख्नुहोस्।
                </p>

                <button
                  className="profile-auth-button"
                  onClick={
                    openSignup
                  }
                >
                  ✨ Create Account
                </button>

                <button
                  className="profile-login-link"
                  onClick={
                    openLogin
                  }
                >
                  पहिले नै account छ?{" "}
                  <strong>
                    Login
                  </strong>
                </button>

              </div>
            )}

          </div>

          <div className="panel-bottom-nav">

            <button
              onClick={() =>
                setPanel("home")
              }
            >
              Home
            </button>

            <button
              onClick={() =>
                setPanel("chat")
              }
            >
              AI Chat
            </button>

            <button className="selected">
              Profile
            </button>

          </div>

        </section>
      )}

      {/* ==================================================
          COMMENTS
          ================================================== */}

      {showComments && (
        <div className="overlay">

          <div className="comments-sheet">

            <div className="sheet-header">

              <strong>
                Comments
              </strong>

              <button
                onClick={() =>
                  setShowComments(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="comments-list">

              {comments.length ===
              0 ? (
                <div className="empty-comments">
                  अहिलेसम्म comment छैन।
                  <br />
                  पहिलो comment तपाईं गर्नुहोस्।
                </div>
              ) : (
                comments.map(
                  (
                    comment,
                    index
                  ) => (
                    <div
                      key={`${comment}-${index}`}
                      className="comment-item"
                    >

                      <div className="comment-avatar">
                        U
                      </div>

                      <div>

                        <strong>
                          You
                        </strong>

                        <p>
                          {comment}
                        </p>

                      </div>

                    </div>
                  )
                )
              )}

            </div>

            <div className="comment-input-row">

              <input
                value={
                  commentText
                }
                onChange={(event) =>
                  setCommentText(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    addComment();
                  }
                }}
                placeholder="Comment लेख्नुहोस्..."
              />

              <button
                onClick={
                  addComment
                }
              >
                ↑
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ==================================================
          AUTH MODAL
          ================================================== */}

      {showAuth && (
        <div className="overlay auth-overlay">

          <div className="auth-sheet">

            {/* AUTH HEADER */}

            <div className="sheet-header">

              <strong>
                {authMode ===
                "login"
                  ? "Login"
                  : "Create Account"}
              </strong>

              <button
                onClick={
                  closeAuth
                }
                disabled={
                  authLoading
                }
              >
                ×
              </button>

            </div>

            {/* AUTH ICON */}

            <div className="auth-icon">
              {authMode ===
              "login"
                ? "🔐"
                : "✨"}
            </div>

            <h2 className="auth-title">
              {authMode ===
              "login"
                ? "फेरि स्वागत छ"
                : "आज के छ? मा account बनाउनुहोस्"}
            </h2>

            <p className="auth-subtitle">
              {authMode ===
              "login"
                ? "आफ्नो account मा login गर्नुहोस्।"
                : "तपाईंको profile सुरक्षित राख्न account बनाउनुहोस्।"}
            </p>

            {/* AUTH FORM */}

            <form
              onSubmit={
                handleAuthSubmit
              }
              className="auth-form"
            >

              {/* NAME */}

              {authMode ===
                "signup" && (
                <div className="auth-field">

                  <label>
                    Name
                  </label>

                  <input
                    type="text"
                    value={
                      authName
                    }
                    onChange={(
                      event
                    ) =>
                      setAuthName(
                        event.target
                          .value
                      )
                    }
                    placeholder="तपाईंको नाम"
                    autoComplete="name"
                    disabled={
                      authLoading
                    }
                  />

                </div>
              )}

              {/* EMAIL */}

              <div className="auth-field">

                <label>
                  Email
                </label>

                <input
                  type="email"
                  value={
                    authEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setAuthEmail(
                      event.target
                        .value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={
                    authLoading
                  }
                />

              </div>

              {/* PASSWORD */}

              <div className="auth-field">

                <label>
                  Password
                </label>

                <input
                  type="password"
                  value={
                    authPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setAuthPassword(
                      event.target
                        .value
                    )
                  }
                  placeholder="कम्तीमा 6 characters"
                  autoComplete={
                    authMode ===
                    "login"
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={
                    authLoading
                  }
                />

              </div>

              {/* ERROR */}

              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}

              {/* SUCCESS */}

              {authSuccess && (
                <div className="auth-success">
                  {authSuccess}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                className="auth-submit-button"
                disabled={
                  authLoading
                }
              >
                {authLoading
                  ? "Please wait..."
                  : authMode ===
                    "login"
                  ? "🔐 Login"
                  : "✨ Create Account"}
              </button>

            </form>

            {/* SWITCH AUTH */}

            <div className="auth-switch">

              {authMode ===
              "login" ? (
                <>
                  <span>
                    Account छैन?
                  </span>

                  <button
                    type="button"
                    onClick={
                      openSignup
                    }
                    disabled={
                      authLoading
                    }
                  >
                    Create Account
                  </button>
                </>
              ) : (
                <>
                  <span>
                    पहिले नै account छ?
                  </span>

                  <button
                    type="button"
                    onClick={
                      openLogin
                    }
                    disabled={
                      authLoading
                    }
                  >
                    Login
                  </button>
                </>
              )}

            </div>

          </div>

        </div>
      )}

    </main>
  );
}