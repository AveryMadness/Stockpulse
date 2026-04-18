import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import socketService from '../services/socketService.js';
import styles from './ChatPage.module.css';

// default rooms available to all users
const DEFAULT_ROOMS = [
  { id: 'general',    name: 'General Market',  ticker: null },
  { id: 'AAPL',       name: 'AAPL Discussion', ticker: 'AAPL' },
  { id: 'NVDA',       name: 'NVDA Discussion', ticker: 'NVDA' },
  { id: 'TSLA',       name: 'TSLA Discussion', ticker: 'TSLA' },
];

export default function ChatPage() {
  const { roomId: paramRoomId } = useParams();
  const navigate  = useNavigate();
  const { username } = useApp();

  // Room list (default + user-created)
  const [rooms,       setRooms]       = useState(DEFAULT_ROOMS);
  const [activeRoom,  setActiveRoom]  = useState(null);

  // Messages for the active room
  const [messages,    setMessages]    = useState([]);
  const [userCount,   setUserCount]   = useState(0);

  // Input state
  const [textInput,   setTextInput]   = useState('');
  const [linkInput,   setLinkInput]   = useState('');
  const [showLink,    setShowLink]     = useState(false);
  const [imageInput,  setImageInput]  = useState('');
  const [showImage,   setShowImage]   = useState(false);

  // Create room form
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newTicker,   setNewTicker]   = useState('');
  const [createError, setCreateError] = useState('');

  const chatEndRef = useRef(null);
  const prevRoomRef = useRef(null);

  useEffect(() => {
    const target = paramRoomId
      ? rooms.find((r) => r.id === paramRoomId) || rooms[0]
      : rooms[0];
    setActiveRoom(target);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeRoom) return;

    socketService.connect();

    // Leave previous room
    if (prevRoomRef.current && prevRoomRef.current !== activeRoom.id) {
      socketService.leaveRoom(prevRoomRef.current, username);
    }
    prevRoomRef.current = activeRoom.id;

    // Join new room and reset state
    setMessages([]);
    setUserCount(0);
    socketService.joinRoom(activeRoom.id, username);

    const offHistory = socketService.onRoomHistory((msgs) =>
      setMessages(msgs)
    );
    const offMsg = socketService.onMessage((msg) =>
      setMessages((prev) => [...prev, msg])
    );
    const offJoined = socketService.onUserJoined(({ userCount: c }) =>
      setUserCount(c)
    );
    const offLeft = socketService.onUserLeft(({ userCount: c }) =>
      setUserCount(c)
    );

    return () => {
      offHistory();
      offMsg();
      offJoined();
      offLeft();
    };
  }, [activeRoom?.id, username]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const switchRoom = (room) => {
    setActiveRoom(room);
    navigate(`/chat/${room.id}`, { replace: true });
    setShowLink(false);
    setShowImage(false);
    setTextInput('');
  };

  const handleSendText = (e) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text || !activeRoom) return;
    socketService.sendMessage(activeRoom.id, {
      username,
      text,
      type: 'text',
      timestamp: new Date().toISOString(),
    });
    setTextInput('');
  };

  const handleSendLink = (e) => {
    e.preventDefault();
    const url = linkInput.trim();
    if (!url || !activeRoom) return;
    socketService.sendMessage(activeRoom.id, {
      username,
      text: url,
      type: 'link',
      timestamp: new Date().toISOString(),
    });
    setLinkInput('');
    setShowLink(false);
  };

  const handleSendImage = (e) => {
    e.preventDefault();
    const url = imageInput.trim();
    if (!url || !activeRoom) return;
    socketService.sendMessage(activeRoom.id, {
      username,
      text: url,
      type: 'image',
      timestamp: new Date().toISOString(),
    });
    setImageInput('');
    setShowImage(false);
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setCreateError('');
    const name   = newName.trim();
    const ticker = newTicker.trim().toUpperCase() || null;

    if (!name) { setCreateError('Room name is required.'); return; }

    const id = ticker
      ? `${ticker}-${Date.now()}`
      : `room-${Date.now()}`;

    if (rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setCreateError('A room with that name already exists.');
      return;
    }

    const newRoom = { id, name, ticker };
    setRooms((prev) => [...prev, newRoom]);
    setNewName('');
    setNewTicker('');
    setShowCreate(false);
    switchRoom(newRoom);
  };

  const renderMessage = (msg, i) => {
    const isSelf = msg.username === username;

    let content;
    if (msg.type === 'link') {
      content = (
        <a
          href={msg.text.startsWith('http') ? msg.text : `https://${msg.text}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.msgLink}
        >
          🔗 {msg.text}
        </a>
      );
    } else if (msg.type === 'image') {
      content = (
        <div>
          <img
            src={msg.text}
            alt="Shared image"
            className={styles.msgImage}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextSibling.style.display = 'block';
            }}
          />
          <span
            className={styles.brokenImg}
            style={{ display: 'none' }}
          >
            [Image could not be loaded: {msg.text}]
          </span>
        </div>
      );
    } else {
      content = <span>{msg.text}</span>;
    }

    return (
      <div
        key={msg.id || i}
        className={isSelf ? `${styles.msg} ${styles.msgSelf}` : styles.msg}
      >
        {!isSelf && (
          <span className={styles.msgUser}>{msg.username}</span>
        )}
        <div className={isSelf ? `${styles.bubble} ${styles.bubbleSelf}` : styles.bubble}>
          {content}
        </div>
        <span className={styles.msgTime}>
          {formatTime(msg.timestamp)}
        </span>
      </div>
    );
  };

  return (
    <main className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Chat Rooms</h2>
          <button
            className="btn"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setShowCreate((v) => !v)}
            aria-expanded={showCreate}
          >
            {showCreate ? '✕' : '+ New'}
          </button>
        </div>

        {/* Create room form */}
        {showCreate && (
          <form className={styles.createForm} onSubmit={handleCreateRoom}>
            <input
              type="text"
              className={styles.createInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Room name"
              maxLength={40}
              required
            />
            <input
              type="text"
              className={styles.createInput}
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="Ticker (optional)"
              maxLength={6}
            />
            {createError && (
              <p className={styles.createError}>{createError}</p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Create Room
            </button>
          </form>
        )}

        {/* Room list */}
        <nav className={styles.roomList} aria-label="Chat rooms">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={
                activeRoom?.id === room.id
                  ? `${styles.roomBtn} ${styles.roomActive}`
                  : styles.roomBtn
              }
              onClick={() => switchRoom(room)}
            >
              <span className={styles.roomHash}>#</span>
              <span className={styles.roomName}>{room.name}</span>
              {room.ticker && (
                <span className={styles.roomTicker}>{room.ticker}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {activeRoom ? (
        <section className={styles.chatArea} aria-labelledby="room-title">
          {/* Header */}
          <header className={styles.chatHeader}>
            <div>
              <h2 id="room-title" className={styles.roomTitle}>
                #{activeRoom.name}
              </h2>
              {userCount > 0 && (
                <span className={styles.onlineCount}>
                  {userCount} online
                </span>
              )}
            </div>
            <div className={styles.attachActions}>
              <button
                className={`btn ${showLink ? styles.active : ''}`}
                onClick={() => { setShowLink((v) => !v); setShowImage(false); }}
                title="Share a link"
              >
                🔗 Link
              </button>
              <button
                className={`btn ${showImage ? styles.active : ''}`}
                onClick={() => { setShowImage((v) => !v); setShowLink(false); }}
                title="Share an image URL"
              >
                🖼 Image
              </button>
            </div>
          </header>

          {/* Link / image bars */}
          {showLink && (
            <form onSubmit={handleSendLink} className={styles.attachBar}>
              <input
                type="url"
                className={styles.attachInput}
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste a URL…"
                autoFocus
              />
              <button type="submit" className="btn btn-primary">
                Share Link
              </button>
            </form>
          )}

          {showImage && (
            <form onSubmit={handleSendImage} className={styles.attachBar}>
              <input
                type="url"
                className={styles.attachInput}
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                placeholder="Paste an image URL…"
                autoFocus
              />
              <button type="submit" className="btn btn-primary">
                Share Image
              </button>
            </form>
          )}

          {/* Messages */}
          <div
            className={styles.messages}
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 && (
              <p className={styles.empty}>
                No messages in this room yet. Say hello!
              </p>
            )}
            {messages.map(renderMessage)}
            <div ref={chatEndRef} />
          </div>

          {/* Text input */}
          <form onSubmit={handleSendText} className={styles.inputBar}>
            <input
              type="text"
              className={styles.textInput}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Message #${activeRoom.name}…`}
              aria-label="Chat message"
              maxLength={1000}
            />
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </form>
        </section>
      ) : (
        <section className={styles.chatArea}>
          <p className={styles.empty}>Select a room to start chatting.</p>
        </section>
      )}
    </main>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
