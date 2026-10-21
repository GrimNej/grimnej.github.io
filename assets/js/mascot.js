// Grim, the site mascot. A small hooded ghost who is (of course) always on his
// phone, and the site's guide. Tap him to chat: he answers a handful of quick
// questions about Ginej and can jump you to any section or hand you the email.
// He also looks up when the pointer comes near, gets excited over contact
// links, drops a tappable line the first time each part of the page appears,
// reacts to the ball pit, and dozes off if nobody's around. He never covers
// content on small screens and can be hidden for the visit.

const EMAIL = "grim98413@gmail.com";

// Speech bubbles. `topic` opens the chat on that answer when the bubble is tapped.
const LINES = {
  hello: { text: "yo, i'm grim. Ginej's ghost. tap me, i know everything here." },
  build: { text: "agentic AI is his whole thing. tap me if that sounds like gibberish.", topic: "agentic" },
  work: { text: "my pick is Ghost Audience. tap me for the tour.", topic: "work" },
  archive: { text: "the full archive. updates itself, no cap." },
  stack: { text: "certified ball knowledge. grab one and throw it.", topic: "stack" },
  contact: { text: "this is the part where you say hi.", topic: "contact" },
  footer: { text: "that's the whole site. now go say hi.", topic: "contact" },
  idle: { text: "still here? lowkey a good sign." },
  fast: { text: "slow down, i'm still reading." },
  copied: { text: "copied. now go send it." },
};

const THROWS = ["nice throw.", "that one had aura.", "yeet.", "physics is cooking.", "do it again."];

const PHONE = [
  "release notes. always release notes.",
  "a 400-reply thread about which model is best. still not settled.",
  "Ginej's GitHub notifications. he pushed again.",
  "a new agent framework dropped. third one today.",
];

const TOPICS = {
  who: {
    q: "Who's Ginej?",
    a: [
      "Ginej Neupane, GrimNej online. Chronically Online AI Savant from Kathmandu, Nepal.",
      "he builds agentic AI. agents, automations, whole products. AI for everything, for everyone.",
    ],
    actions: [{ label: "Read his about", go: "#about" }],
  },
  agentic: {
    q: "What's agentic AI?",
    a: [
      "AI that doesn't just answer. it plans, picks up tools, and finishes the job.",
      "agents, multi-agent teams, MCP tools. it's where everything is headed, and he's already building there.",
    ],
    actions: [{ label: "See what he builds", go: "#build" }],
  },
  work: {
    q: "Show me the work",
    a: [
      "six projects, all built this year, mostly for hackathons and AI challenges.",
      "my pick is Ghost Audience. it reads your pitch like a real crowd would, before you're in the room.",
    ],
    actions: [
      { label: "Take me there", go: "#work" },
      { label: "Try Ghost Audience", href: "https://audience.grimnej.com" },
    ],
  },
  stack: {
    q: "What's his stack?",
    a: ["Python, TypeScript, Rust, and every agent framework worth knowing.", "there's a pit full of logos down there. you can throw them."],
    actions: [{ label: "Go to the pit", go: "#stack" }],
  },
  hire: {
    q: "Can he build my idea?",
    a: ["send it over. you'll get a straight answer on whether it's real, then a working prototype.", "no glazing. if it's mid, he'll say so."],
    actions: [{ label: "Email him", href: `mailto:${EMAIL}?subject=Hey%20Ginej` }],
  },
  contact: {
    q: "How do I reach him?",
    a: ["email is fastest. he reads everything."],
    actions: [
      { label: "Copy email", copy: true },
      { label: "Write an email", href: `mailto:${EMAIL}?subject=Hey%20Ginej` },
      { label: "X", href: "https://x.com/grimnej_" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/grimnej/" },
      { label: "GitHub", href: "https://github.com/GrimNej" },
    ],
  },
  phone: { q: "What's on your phone?" },
};

const ORDER = ["who", "agentic", "work", "contact", "stack", "hire"];
const EXCITING = ".orb, .mail-link, [data-copy], .channel, .menu__mail, a[href^='mailto:']";

export function initGrim({ gsap = null, reduced = false, scrollTo = null, copy = null } = {}) {
  const root = document.querySelector("[data-grim]");
  if (!root) return null;

  let hiddenThisSession = false;
  try {
    hiddenThisSession = sessionStorage.getItem("grim-hidden") === "1";
  } catch {
    /* storage unavailable */
  }
  if (hiddenThisSession) {
    root.classList.add("is-hidden");
    return null;
  }

  const btn = root.querySelector("[data-grim-btn]");
  const bubble = root.querySelector("[data-grim-bubble]");
  const chat = root.querySelector("[data-grim-chat]");
  const log = root.querySelector("[data-grim-log]");
  const chipsEl = root.querySelector("[data-grim-chips]");
  const look = root.querySelector(".grim__look");
  const eyes = root.querySelector(".grim__eyes");
  const happy = root.querySelector(".grim__happy");
  const phone = root.querySelector(".grim__phone");
  const body = root.querySelector(".grim__body");
  const float = root.querySelector(".grim__float");
  const shadow = root.querySelector(".grim__shadow");
  const anim = Boolean(gsap) && !reduced;
  const compact = window.matchMedia("(max-width: 720px), (max-height: 560px)");

  const said = new Set();
  const asked = new Set();
  let bubbleTimer = 0;
  let bubbleTopic = null;
  let excited = false;
  let asleep = false;
  let typing = false;
  let greeted = false;
  let phoneIdx = 0;
  let session = 0; // bumps on open/close so stale replies stop typing
  let lastActive = performance.now();
  const pointer = { x: -9999, y: -9999 };

  const isOpen = () => !chat.hidden;

  /* ---------- Idle life ---------- */

  if (anim) {
    gsap.to(float, { y: -5, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(shadow, { scaleX: 0.8, opacity: 0.6, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
    (function blink() {
      gsap.delayedCall(2.4 + Math.random() * 3.8, () => {
        if (!asleep && !excited) gsap.to(eyes, { scaleY: 0.08, transformOrigin: "50% 50%", duration: 0.07, yoyo: true, repeat: 1, ease: "power1.in" });
        blink();
      });
    })();
  }

  function hop(height = 10) {
    if (!anim) return;
    gsap.fromTo(body, { y: 0 }, { y: -height, duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1, overwrite: "auto" });
  }

  /* ---------- Eyes: phone, pointer, or the chat ---------- */

  let eyeX = 0;
  let eyeY = 4;
  let phoneUp = 0;
  let rect = btn.getBoundingClientRect();
  let rectAt = 0;
  function track() {
    const now = performance.now();
    if (now - rectAt > 400) {
      rect = btn.getBoundingClientRect();
      rectAt = now;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.42;
    let dx = pointer.x - cx;
    let dy = pointer.y - cy;
    if (isOpen()) {
      // Looks up at the conversation.
      dx = -40;
      dy = -120;
    }
    const dist = Math.hypot(dx, dy);
    const attentive = isOpen() || excited || bubble.classList.contains("is-on") || dist < 380;
    let tx = 0;
    let ty = 4.5; // looking down at the phone
    if (attentive && !asleep) {
      const k = Math.min(dist / 90, 1);
      tx = (dx / (dist || 1)) * 3.6 * k;
      ty = (dy / (dist || 1)) * 3 * k;
    }
    eyeX += (tx - eyeX) * 0.2;
    eyeY += (ty - eyeY) * 0.2;
    phoneUp += ((attentive ? 1 : 0) - phoneUp) * 0.12;
    look.setAttribute("transform", `translate(${eyeX.toFixed(2)} ${eyeY.toFixed(2)})`);
    phone.setAttribute("transform", `translate(0 ${(phoneUp * 5).toFixed(2)})`);

    const idle = now - lastActive;
    if (!asleep && idle > 45000 && !isOpen()) sleep(true);
    if (idle > 20000 && idle < 21000) say("idle");
    requestAnimationFrame(track);
  }

  function wake() {
    lastActive = performance.now();
    if (asleep) sleep(false);
  }

  function sleep(on) {
    asleep = on;
    root.classList.toggle("is-asleep", on);
    if (gsap) gsap.to(eyes, { scaleY: on ? 0.12 : 1, transformOrigin: "50% 50%", duration: on ? 0.6 : 0.2, ease: "power2.out" });
    else eyes.style.transform = on ? "scaleY(0.12)" : "";
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      wake();
    },
    { passive: true }
  );
  window.addEventListener("keydown", wake);

  // Scroll: wake up, notice very fast scrolling, and (on small screens) stay out
  // of the first view and dip while the page moves.
  const small = window.matchMedia("(max-width: 720px)");
  let sinkTimer = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();
  function onScroll() {
    wake();
    const now = performance.now();
    const v = Math.abs(window.scrollY - lastY) / Math.max(now - lastT, 1);
    lastY = window.scrollY;
    lastT = now;
    if (v > 7 && !said.has("fast")) {
      say("fast");
      if (anim) gsap.fromTo(body, { scaleY: 1, scaleX: 1 }, { scaleY: 0.85, scaleX: 1.12, duration: 0.15, yoyo: true, repeat: 1 });
    }
    if (!small.matches) {
      root.classList.remove("is-tucked", "is-sunk");
      return;
    }
    root.classList.toggle("is-tucked", window.scrollY < window.innerHeight * 0.6 && !isOpen());
    if (isOpen()) return;
    root.classList.add("is-sunk");
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(() => root.classList.remove("is-sunk"), 450);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  small.addEventListener("change", onScroll);
  onScroll();
  requestAnimationFrame(track);

  /* ---------- Moods ---------- */

  function setExcited(on) {
    if (on === excited) return;
    excited = on;
    if (!gsap) {
      happy.style.opacity = on ? 1 : 0;
      eyes.style.opacity = on ? 0 : 1;
      return;
    }
    gsap.to(happy, { opacity: on ? 1 : 0, duration: 0.2 });
    gsap.to(eyes, { opacity: on ? 0 : 1, duration: 0.2 });
    if (on) hop(12);
  }

  document.addEventListener("pointerover", (e) => {
    if (!(e.target instanceof Element)) return;
    setExcited(Boolean(e.target.closest(EXCITING)) && !e.target.closest("[data-grim]"));
  });

  /* ---------- Speech bubbles ---------- */

  // Small screens have no spare room, so only reactions to the visitor show there.
  const COMPACT_KEYS = new Set(["copied", "throw"]);

  function showBubble(text, topic = null, ms = 4400) {
    clearTimeout(bubbleTimer);
    bubbleTopic = topic;
    bubble.textContent = text;
    bubble.classList.toggle("has-topic", Boolean(topic));
    requestAnimationFrame(() => bubble.classList.add("is-on"));
    bubbleTimer = setTimeout(hideBubble, ms);
  }

  // Returns true once the line has been handled (shown, or never shown on this screen size).
  function say(key, { force = false } = {}) {
    const line = LINES[key];
    if (!line || (said.has(key) && !force)) return true;
    if (compact.matches && !COMPACT_KEYS.has(key)) return true;
    if (isOpen()) return false;
    said.add(key);
    showBubble(line.text, line.topic || null);
    return true;
  }

  function hideBubble() {
    bubble.classList.remove("is-on");
  }

  bubble.addEventListener("click", () => {
    const topic = bubbleTopic;
    hideBubble();
    openChat(topic);
  });

  const triggers = [
    ["#build", "build"],
    ["#work .projects", "work"],
    ["[data-archive]", "archive"],
    ["#stack .pit", "stack"],
    ["#contact .contact__mail", "contact"],
    [".footer__row", "footer"],
  ];
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (!say(e.target.dataset.grimLine)) return; // chat open: try again next time it appears
        io.unobserve(e.target);
        if (e.target.dataset.grimLine === "contact") {
          setExcited(true);
          setTimeout(() => setExcited(false), 1600);
        }
      }),
    { threshold: 0.35 }
  );
  triggers.forEach(([sel, key]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.dataset.grimLine = key;
    io.observe(el);
  });

  let lastThrow = 0;
  document.addEventListener("pit:throw", () => {
    const now = performance.now();
    if (now - lastThrow < 7000 || isOpen()) return;
    lastThrow = now;
    if (compact.matches && said.has("throw")) return;
    said.add("throw");
    showBubble(THROWS[Math.floor(Math.random() * THROWS.length)], null, 2600);
    hop(14);
  });

  /* ---------- Chat ---------- */

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  function addMsg(cls, text) {
    const li = document.createElement("div");
    li.className = `msg ${cls}`;
    li.textContent = text;
    log.append(li);
    if (anim) gsap.from(li, { y: 10, opacity: 0, scale: 0.96, duration: 0.4, ease: "expo.out", transformOrigin: cls === "msg--you" ? "100% 100%" : "0% 100%" });
    scrollLog();
    return li;
  }

  async function grimSays(lines) {
    const id = session;
    typing = true;
    renderChips();
    for (const text of lines) {
      const dots = document.createElement("div");
      dots.className = "msg msg--grim msg--typing";
      dots.setAttribute("aria-hidden", "true");
      dots.innerHTML = "<span></span><span></span><span></span>";
      log.append(dots);
      scrollLog();
      await wait(reduced ? 150 : Math.min(420 + text.length * 11, 1100));
      dots.remove();
      if (!isOpen() || id !== session) return;
      addMsg("msg--grim", text);
      hop(6);
      await wait(reduced ? 60 : 180);
    }
    if (id === session) typing = false;
  }

  function addActions(actions) {
    const li = document.createElement("div");
    li.className = "msg msg--actions";
    actions.forEach((act) => {
      let el;
      if (act.href) {
        el = document.createElement("a");
        el.href = act.href;
        if (!act.href.startsWith("mailto:")) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      } else {
        el = document.createElement("button");
        el.type = "button";
      }
      el.className = "msg__action";
      el.textContent = act.label;
      el.addEventListener("click", () => {
        if (act.go) {
          // Small screens: the chat covers the page, so close it and move focus
          // to the section. Larger screens: keep chatting while the page scrolls.
          if (compact.matches) {
            closeChat(false);
            scrollTo?.(act.go);
          } else {
            scrollTo?.(act.go, { focus: false });
          }
        } else if (act.copy) {
          copy?.(EMAIL);
        }
      });
      li.append(el);
    });
    log.append(li);
    if (anim) gsap.from(li.children, { y: 8, opacity: 0, duration: 0.35, stagger: 0.05, ease: "power3.out" });
    scrollLog();
  }

  function chipKeys() {
    const fresh = ORDER.filter((k) => !asked.has(k));
    const picks = (fresh.length ? fresh : ["contact", "work", "agentic"]).slice(0, 3);
    return [...picks, "phone"];
  }

  function renderChips() {
    chipsEl.replaceChildren();
    if (typing) return;
    chipKeys().forEach((key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "grim__chip";
      b.textContent = TOPICS[key].q;
      b.addEventListener("click", () => ask(key));
      chipsEl.append(b);
    });
    if (anim) gsap.from(chipsEl.children, { y: 6, opacity: 0, duration: 0.3, stagger: 0.04, ease: "power3.out" });
    scrollLog();
  }

  // Keep the newest message in view when the log resizes (the chip row
  // appearing or disappearing changes the space it has).
  if ("ResizeObserver" in window) new ResizeObserver(scrollLog).observe(log);

  async function ask(key, { echo = true } = {}) {
    if (typing) return;
    const topic = TOPICS[key];
    if (echo) addMsg("msg--you", topic.q);
    asked.add(key);
    let lines = topic.a;
    if (key === "phone") {
      lines = [PHONE[phoneIdx % PHONE.length]];
      phoneIdx += 1;
    }
    const id = session;
    await grimSays(lines);
    if (!isOpen() || id !== session) return;
    if (topic.actions) addActions(topic.actions);
    renderChips();
    chipsEl.querySelector("button")?.focus({ preventScroll: true });
  }

  async function openChat(topic = null) {
    if (isOpen()) {
      if (topic) ask(topic);
      return;
    }
    const wasAsleep = asleep;
    session += 1;
    typing = false;
    wake();
    hideBubble();
    chat.hidden = false;
    root.classList.add("is-chatting");
    root.classList.remove("is-tucked", "is-sunk");
    btn.setAttribute("aria-expanded", "true");
    if (anim) gsap.fromTo(chat, { opacity: 0, y: 16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "expo.out" });
    hop(12);
    chat.querySelector("[data-grim-close]")?.focus({ preventScroll: true });

    let opening;
    if (wasAsleep) opening = ["huh? oh. hi.", "i was resting my eyes. what's up?"];
    else if (!greeted) opening = ["yo, i'm grim. Ginej's ghost.", "ask me anything about him."];
    else opening = ["back again? what do you need?"];
    greeted = true;

    if (topic) {
      await grimSays([opening[0]]);
      if (isOpen()) await ask(topic);
    } else {
      await grimSays(opening);
      if (isOpen()) {
        renderChips();
        chipsEl.querySelector("button")?.focus({ preventScroll: true });
      }
    }
  }

  function closeChat(returnFocus = true) {
    if (!isOpen()) return;
    chat.hidden = true;
    session += 1;
    typing = false;
    root.classList.remove("is-chatting");
    btn.setAttribute("aria-expanded", "false");
    log.querySelectorAll(".msg--typing").forEach((n) => n.remove());
    if (returnFocus) btn.focus({ preventScroll: true });
    onScroll();
  }

  btn.addEventListener("click", () => {
    if (isOpen()) closeChat();
    else openChat();
    if (anim) gsap.fromTo(btn, { rotation: -8 }, { rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
  });

  chat.querySelector("[data-grim-close]")?.addEventListener("click", () => closeChat());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeChat();
  });
  document.addEventListener("pointerdown", (e) => {
    if (isOpen() && !root.contains(e.target)) closeChat(false);
  });

  chat.querySelector("[data-grim-hide]")?.addEventListener("click", () => {
    closeChat(false);
    hideBubble();
    try {
      sessionStorage.setItem("grim-hidden", "1");
    } catch {
      /* ignore */
    }
    if (anim) {
      gsap.to(btn, { y: 160, rotation: 20, duration: 0.6, ease: "back.in(1.4)", onComplete: () => root.classList.add("is-hidden") });
    } else root.classList.add("is-hidden");
  });

  document.addEventListener("grim:copied", () => {
    if (isOpen()) {
      if (!typing) grimSays(["copied. now go send it."]).then(() => isOpen() && !typing && renderChips());
    } else {
      say("copied", { force: true });
    }
    if (anim) gsap.fromTo(body, { rotation: 0 }, { rotation: 360, duration: 0.9, ease: "back.out(1.3)", transformOrigin: "50% 60%" });
  });

  return {
    hello() {
      if (anim) gsap.from(btn, { y: 140, rotation: -12, duration: 1.1, ease: "back.out(1.5)" });
      setTimeout(() => say("hello"), anim ? 1300 : 400);
    },
  };
}
