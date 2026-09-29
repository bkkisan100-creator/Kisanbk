"use client";

import { useEffect, useRef, useState } from "react";

type Bulletin = {
  id: number;
  title: string;
  summary?: string;
  audio_url?: string;
  story_count?: number;
  published_at?: string;
  like_count?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Panel = "home" | "search" | "chat" | "alerts" | "profile";

const CHAT_STORAGE_KEY = "aaja-ke-chha-ai-chat-history";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shortTitle(title: string) {
  if (!title) return "आजको मुख्य समाचार";

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

  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [loadingBulletin, setLoadingBulletin] = useState(true);

  const [panel, setPanel] = useState<Panel>("home");

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Bulletin[]>([]);
  const [searching, setSearching] = useState(false);

  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  /*
   * ============================
   * CHATGPT-LIKE CHAT STATE
   * ============================
   */

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [chatInput, setChatInput] = useState("");

  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  /*
   * Splash
   */

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  /*
   * Load latest bulletin
   */

  useEffect(() => {
    loadBulletin();
  }, []);

  async function loadBulletin() {
    try {
      setLoadingBulletin(true);

      const response = await fetch("/api/news/bulletin/latest", {
        cache: "no-store",
      });

      const data = await response.json();

      if (data?.success && data?.bulletin) {
        setBulletin(data.bulletin);
        setLikeCount(data.bulletin.like_count || 0);
      } else if (data?.success && data?.id) {
        setBulletin(data);
        setLikeCount(data.like_count || 0);
      }
    } catch (error) {
      console.error("Bulletin loading error:", error);
    } finally {
      setLoadingBulletin(false);
    }
  }

  /*
   * ============================
   * LOAD CHAT HISTORY
   * ============================
   */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setChatMessages(parsed);
          return;
        }
      }

      setChatMessages([
        {
          id: makeId(),
          role: "assistant",
          text: "नमस्कार 👋 म आज के छ? को AI Assistant हुँ। समाचार मात्र होइन, जुनसुकै विषयमा मसँग कुरा गर्न सक्नुहुन्छ।",
        },
      ]);
    } catch (error) {
      console.error("Chat history loading error:", error);

      setChatMessages([
        {
          id: makeId(),
          role: "assistant",
          text: "नमस्कार 👋 आज के छ? मा स्वागत छ। जुनसुकै विषयमा मसँग कुरा गर्न सक्नुहुन्छ।",
        },
      ]);
    }
  }, []);

  /*
   * ============================
   * SAVE CHAT HISTORY
   * ============================
   */

  useEffect(() => {
    if (!chatMessages.length) return;

    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(chatMessages)
      );
    } catch (error) {
      console.error("Chat history save error:", error);
    }
  }, [chatMessages]);

  /*
   * Automatically scroll to newest message
   */

  useEffect(() => {
    if (panel !== "chat") return;

    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [chatMessages, chatLoading, panel]);

  /*
   * ============================
   * NEW CHAT
   * ============================
   */

  function startNewChat() {
    const firstMessage: ChatMessage = {
      id: makeId(),
      role: "assistant",
      text: "नयाँ chat सुरु भयो 👋 अब के कुरा गरौँ?",
    };

    setChatMessages([firstMessage]);

    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify([firstMessage])
      );
    } catch (error) {
      console.error("New chat storage error:", error);
    }
  }

  /*
   * ============================
   * SEND CHAT MESSAGE
   * ============================
   */

  async function sendChatMessage() {
    const message = chatInput.trim();

    if (!message || chatLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      text: message,
    };

    const updatedMessages = [...chatMessages, userMessage];

    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      /*
       * Only send the useful conversation text to API.
       */

      const history = updatedMessages
        .slice(-12)
        .map((item) => ({
          role: item.role,
          text: item.text,
        }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history,
          news: bulletin
            ? {
                title: bulletin.title,
                summary: bulletin.summary || "",
              }
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || "AI response failed"
        );
      }

      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text:
          data.reply ||
          "माफ गर्नुहोस्, अहिले उत्तर दिन सकिनँ।",
      };

      setChatMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      const errorMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text:
          "माफ गर्नुहोस्, अहिले AI सँग connection हुन सकेन। केही बेरपछि फेरि प्रयास गर्नुहोस्।",
      };

      setChatMessages((previous) => [
        ...previous,
        errorMessage,
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  /*
   * Enter to send
   * Shift + Enter = new line
   */

  function handleChatKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  /*
   * ============================
   * AUDIO
   * ============================
   */

  function toggleAudio() {
    const audio = audioRef.current;

    if (!audio) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setAudioPlaying(true);
        })
        .catch((error) => {
          console.error("Audio play error:", error);
        });
    } else {
      audio.pause();
      setAudioPlaying(false);
    }
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) return;

    setAudioCurrent(audio.currentTime);
  }

  function handleAudioLoadedMetadata() {
    const audio = audioRef.current;

    if (!audio) return;

    setAudioDuration(audio.duration || 0);
  }

  function handleAudioEnded() {
    setAudioPlaying(false);
    setAudioCurrent(0);
  }

  function handleAudioSeek(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = Number(event.target.value);

    setAudioCurrent(value);

    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  }

  /*
   * ============================
   * LIKE
   * ============================
   */

  async function toggleLike() {
    const nextLiked = !liked;

    setLiked(nextLiked);

    setLikeCount((count) =>
      nextLiked
        ? count + 1
        : Math.max(0, count - 1)
    );

    try {
      await fetch("/api/bulletin/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bulletin_id: bulletin?.id,
          liked: nextLiked,
        }),
      });
    } catch (error) {
      console.error("Like error:", error);
    }
  }

  /*
   * ============================
   * SHARE
   * ============================
   */

  async function shareNews() {
    const title =
      bulletin?.title || "आज के छ?";

    const shareData = {
      title: "आज के छ?",
      text: title,
      url: window.location.href,
    };

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.share
      ) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          `${title}\n${window.location.href}`
        );

        alert("Link copied!");
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  }

  /*
   * ============================
   * COMMENTS
   * ============================
   */

  function addComment() {
    const value = commentText.trim();

    if (!value) return;

    setComments((previous) => [
      ...previous,
      value,
    ]);

    setCommentText("");
  }

  /*
   * ============================
   * SEARCH
   * ============================
   */

  async function performSearch() {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);

      const response = await fetch(
        `/api/news/search?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (data?.success) {
        setSearchResults(data.news || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  /*
   * ============================
   * SPLASH SCREEN
   * ============================
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
   * ============================
   * MAIN APP
   * ============================
   */

  return (
    <main className="app-shell">
      {bulletin?.audio_url && (
        <audio
          ref={audioRef}
          src={bulletin.audio_url}
          preload="metadata"
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onEnded={handleAudioEnded}
        />
      )}

      {panel === "home" && (
        <section className="home-screen">
          <div className="news-background">
            <div className="background-glow glow-one" />
            <div className="background-glow glow-two" />
            <div className="background-grid" />
          </div>

          <header className="top-header">
            <div className="brand">
              <div className="brand-logo">
                आ
              </div>

              <div>
                <div className="brand-title">
                  आज के छ?
                </div>

                <div className="brand-subtitle">
                  AI News
                </div>
              </div>
            </div>

            <button
              className="icon-button notification-button"
              onClick={() => setPanel("alerts")}
              aria-label="Notifications"
            >
              <span>🔔</span>
              <b>3</b>
            </button>
          </header>

          <div className="live-pill">
            <span className="live-dot" />
            LIVE NEWS
          </div>

          <div className="news-content">
            {loadingBulletin ? (
              <div className="loading-news">
                <div className="loading-circle" />
                <p>समाचार तयार हुँदैछ...</p>
              </div>
            ) : bulletin ? (
              <>
                <div className="news-meta">
                  <span>आज के छ?</span>
                  <span>•</span>
                  <span>
                    {formatPublishedTime(
                      bulletin.published_at
                    )}
                  </span>
                </div>

                <h1 className="news-headline">
                  {shortTitle(bulletin.title)}
                </h1>

                {bulletin.summary && (
                  <p className="news-summary">
                    {bulletin.summary}
                  </p>
                )}

                <div className="news-bottom-space" />
              </>
            ) : (
              <div className="loading-news">
                <p>अहिले bulletin उपलब्ध छैन।</p>
              </div>
            )}
          </div>

          <aside className="right-actions">
            <button
              className={`action-button ${
                liked ? "active" : ""
              }`}
              onClick={toggleLike}
            >
              <span className="action-icon">
                {liked ? "❤️" : "🤍"}
              </span>

              <small>{likeCount}</small>
            </button>

            <button
              className="action-button"
              onClick={() => setShowComments(true)}
            >
              <span className="action-icon">
                💬
              </span>

              <small>{comments.length}</small>
            </button>

            <button
              className="action-button"
              onClick={shareNews}
            >
              <span className="action-icon">
                ↗
              </span>

              <small>Share</small>
            </button>
          </aside>

          {bulletin && (
            <div className="audio-dock">
              <div className="audio-top">
                <button
                  className="play-button"
                  onClick={toggleAudio}
                  aria-label="Play audio"
                >
                  {audioPlaying ? "Ⅱ" : "▶"}
                </button>

                <div className="audio-info">
                  <div className="audio-title">
                    आजको Audio Bulletin
                  </div>

                  <div className="audio-subtitle">
                    AI द्वारा तयार गरिएको
                  </div>
                </div>

                <div className="wave">
                  {Array.from({
                    length: 38,
                  }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        audioPlaying
                          ? "wave-bar playing"
                          : "wave-bar"
                      }
                      style={{
                        animationDelay: `${
                          index * 0.035
                        }s`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="audio-progress-row">
                <span>
                  {formatTime(audioCurrent)}
                </span>

                <input
                  type="range"
                  min="0"
                  max={
                    audioDuration > 0
                      ? audioDuration
                      : 0
                  }
                  step="0.1"
                  value={
                    audioDuration > 0
                      ? Math.min(
                          audioCurrent,
                          audioDuration
                        )
                      : 0
                  }
                  onChange={handleAudioSeek}
                  className="audio-range"
                />

                <span>
                  {formatTime(audioDuration)}
                </span>
              </div>
            </div>
          )}

          <div className="next-update">
            <span className="update-dot" />
            हरेक घण्टा नयाँ bulletin
          </div>

          <nav className="bottom-nav">
            <button
              className="nav-item active"
              onClick={() => setPanel("home")}
            >
              <span>⌂</span>
              <small>Home</small>
            </button>

            <button
              className="nav-item"
              onClick={() => setPanel("search")}
            >
              <span>⌕</span>
              <small>Search</small>
            </button>

            <button
              className="ai-nav-button"
              onClick={() => setPanel("chat")}
            >
              <span>AI</span>
            </button>

            <button
              className="nav-item"
              onClick={() => setPanel("alerts")}
            >
              <span>♢</span>
              <small>Alerts</small>
            </button>

            <button
              className="nav-item"
              onClick={() => setPanel("profile")}
            >
              <span>◯</span>
              <small>Profile</small>
            </button>
          </nav>
        </section>
      )}

      {panel === "search" && (
        <section className="full-panel">
          <header className="panel-header">
            <button
              className="back-button"
              onClick={() => setPanel("home")}
            >
              ←
            </button>

            <h2>Search</h2>

            <div />
          </header>

          <div className="search-box">
            <span>⌕</span>

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  performSearch();
                }
              }}
              placeholder="समाचार खोज्नुहोस्..."
              autoFocus
            />

            <button onClick={performSearch}>
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
              searchResults.length === 0 && (
                <div className="empty-state">
                  कुनै समाचार भेटिएन।
                </div>
              )}

            {searchResults.map((item) => (
              <article
                key={item.id}
                className="search-card"
              >
                <div className="search-card-meta">
                  {formatPublishedTime(
                    item.published_at
                  )}
                </div>

                <h3>{item.title}</h3>

                {item.summary && (
                  <p>{item.summary}</p>
                )}
              </article>
            ))}
          </div>

          <div className="panel-bottom-nav">
            <button
              onClick={() => setPanel("home")}
            >
              Home
            </button>

            <button className="selected">
              Search
            </button>

            <button
              onClick={() => setPanel("chat")}
            >
              AI Chat
            </button>
          </div>
        </section>
      )}

      {panel === "chat" && (
        <section className="chat-screen">
          <header className="chat-header">
            <button
              className="chat-back"
              onClick={() => setPanel("home")}
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
              onClick={startNewChat}
              title="New Chat"
            >
              ＋
            </button>
          </header>

          <div className="chat-history">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`chat-row ${
                  message.role === "user"
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
                    message.role === "user"
                      ? "user-bubble"
                      : "assistant-bubble"
                  }`}
                >
                  {message.text
                    .split("\n")
                    .map((line, index) => (
                      <span key={index}>
                        {line}

                        {index <
                          message.text.split(
                            "\n"
                          ).length -
                            1 && <br />}
                      </span>
                    ))}
                </div>

                {message.role === "user" && (
                  <div className="message-avatar user-avatar">
                    You
                  </div>
                )}
              </div>
            ))}

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

            <div ref={chatEndRef} />
          </div>

          <div className="chat-composer">
            <textarea
              value={chatInput}
              onChange={(event) =>
                setChatInput(event.target.value)
              }
              onKeyDown={handleChatKeyDown}
              placeholder="जे सोध्न मन लाग्छ सोध्नुहोस्..."
              rows={1}
              disabled={chatLoading}
            />

            <button
              className="send-button"
              onClick={sendChatMessage}
              disabled={
                !chatInput.trim() || chatLoading
              }
            >
              ↑
            </button>
          </div>

          <div className="chat-hint">
            AI ले गल्ती गर्न सक्छ। महत्वपूर्ण
            जानकारी verify गर्नुहोस्।
          </div>
        </section>
      )}

      {panel === "alerts" && (
        <section className="full-panel">
          <header className="panel-header">
            <button
              className="back-button"
              onClick={() => setPanel("home")}
            >
              ←
            </button>

            <h2>Notifications</h2>

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
                  आजको नयाँ AI audio bulletin
                  सुन्नुहोस्।
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
                  जुनसुकै विषयमा AI सँग कुरा
                  गर्नुहोस्।
                </p>

                <small>
                  आज
                </small>
              </div>
            </div>
          </div>

          <div className="panel-bottom-nav">
            <button
              onClick={() => setPanel("home")}
            >
              Home
            </button>

            <button
              onClick={() => setPanel("chat")}
            >
              AI Chat
            </button>

            <button className="selected">
              Alerts
            </button>
          </div>
        </section>
      )}

      {panel === "profile" && (
        <section className="full-panel">
          <header className="panel-header">
            <button
              className="back-button"
              onClick={() => setPanel("home")}
            >
              ←
            </button>

            <h2>Profile</h2>

            <div />
          </header>

          <div className="profile-content">
            <div className="profile-avatar">
              आ
            </div>

            <h2>आज के छ?</h2>

            <p>
              AI-powered Nepali News
            </p>

            <div className="profile-card">
              <div>
                <span>Language</span>
                <strong>
                  नेपाली
                </strong>
              </div>

              <div>
                <span>AI Assistant</span>
                <strong>
                  Gemini AI
                </strong>
              </div>

              <div>
                <span>News</span>
                <strong>
                  AI Audio Bulletin
                </strong>
              </div>
            </div>
          </div>

          <div className="panel-bottom-nav">
            <button
              onClick={() => setPanel("home")}
            >
              Home
            </button>

            <button
              onClick={() => setPanel("chat")}
            >
              AI Chat
            </button>

            <button className="selected">
              Profile
            </button>
          </div>
        </section>
      )}

      {showComments && (
        <div className="overlay">
          <div className="comments-sheet">
            <div className="sheet-header">
              <strong>
                Comments
              </strong>

              <button
                onClick={() =>
                  setShowComments(false)
                }
              >
                ×
              </button>
            </div>

            <div className="comments-list">
              {comments.length === 0 ? (
                <div className="empty-comments">
                  अहिलेसम्म comment छैन।
                  <br />
                  पहिलो comment तपाईं गर्नुहोस्।
                </div>
              ) : (
                comments.map(
                  (comment, index) => (
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

                        <p>{comment}</p>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <div className="comment-input-row">
              <input
                value={commentText}
                onChange={(event) =>
                  setCommentText(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addComment();
                  }
                }}
                placeholder="Comment लेख्नुहोस्..."
              />

              <button onClick={addComment}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}