// Application state: conversations, messages, the streaming reply, menus and dialogs.

///|
struct Msg {
  id : Int32
  role : String
  text : @resource.Signal[String]
  shown : @resource.Signal[Int32]
  streaming : @resource.Signal[Bool]
  stopped : @resource.Signal[Bool]
  feedback : @resource.Signal[Int32]
  reading : @resource.Signal[Bool]
  editing : @resource.Signal[Bool]
  copied : @resource.Signal[Bool]
  code_copied : @resource.Signal[Int32]
}

///|
struct Conv {
  id : Int32
  title : @resource.Signal[String]
  group : String
  messages : @resource.Signal[Array[Msg]]
}

///|
let next_id : Ref[Int32] = Ref(1)

///|
fn fresh_id() -> Int32 {
  let v = next_id.val
  next_id.val = v + 1
  v
}

///|
fn new_msg(role : String, text : String, complete : Bool) -> Msg {
  {
    id: fresh_id(),
    role,
    text: @resource.signal(text),
    shown: @resource.signal(if complete { text.length() } else { 0 }),
    streaming: @resource.signal(!complete),
    stopped: @resource.signal(false),
    feedback: @resource.signal(0),
    reading: @resource.signal(false),
    editing: @resource.signal(false),
    copied: @resource.signal(false),
    code_copied: @resource.signal(-1),
  }
}

///|
/// What the reader sees of a message: all of it, or the part streamed so far.
fn Msg::visible(self : Msg) -> String {
  let t = self.text.get()
  let n = self.shown.get()
  if n >= t.length() {
    t
  } else {
    t.substring(end=n)
  }
}

///|
fn seed_convs() -> Array[Conv] {
  seed_titles.mapi(fn(i, pair) {
    let (title, group) = pair
    let msgs = if i == 0 {
      [
        new_msg("user", lunar_q1, true),
        new_msg("assistant", lunar_a1, true),
        new_msg("user", lunar_q2, true),
        new_msg("assistant", lunar_a2, true),
      ]
    } else {
      [
        new_msg("user", title, true),
        new_msg("assistant", seeded_reply(title), true),
      ]
    }
    {
      id: fresh_id(),
      title: @resource.signal(title),
      group,
      messages: @resource.signal(msgs),
    }
  })
}

///|
let convs : @resource.Signal[Array[Conv]] = @resource.signal(seed_convs())

///|
/// The open conversation's id; -1 is the empty "New chat" state.
let current : @resource.Signal[Int32] = @resource.signal(-1)

///|
let query : @resource.Signal[String] = @resource.signal("")

///|
let row_menu : @resource.Signal[Int32] = @resource.signal(-1)

///|
let row_menu_style : @resource.Signal[String] = @resource.signal("")

///|
let renaming : @resource.Signal[Int32] = @resource.signal(-1)

///|
let confirm_delete : @resource.Signal[Int32] = @resource.signal(-1)

///|
let model : @resource.Signal[String] = @resource.signal("swift")

///|
let model_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let attach_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let share_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let link_copied : @resource.Signal[Bool] = @resource.signal(false)

///|
let collapsed : @resource.Signal[Bool] = @resource.signal(false)

///|
let drawer : @resource.Signal[Bool] = @resource.signal(false)

///|
/// The drawer slides only when the reader opens or closes it, never when a resize crosses the breakpoint.
let drawer_anim : @resource.Signal[Bool] = @resource.signal(false)

///|
fn set_drawer(open : Bool) -> Unit {
  drawer_anim.set(true)
  drawer.set(open)
}

///|
let draft : @resource.Signal[String] = @resource.signal("")

///|
let busy : @resource.Signal[Bool] = @resource.signal(false)

///|
/// True while the conversation is scrolled to (near) its end.
let pinned : @resource.Signal[Bool] = @resource.signal(true)

///|
let status : @resource.Signal[String] = @resource.signal("")

///|
let active : Ref[Msg?] = Ref(None)

///|
let timer : Ref[Int32] = Ref(-1)

///|
let scroller : Ref[@js.Any] = Ref(@js.undefined())

///|
let prompt_el : Ref[@js.Any] = Ref(@js.undefined())

///|
/// Replies appear whole: ?animate=0 or prefers-reduced-motion.
let instant : Ref[Bool] = Ref(false)

///|
let words_per_tick : Int32 = 3

///|
let tick_ms : Int32 = 50

///|
fn find_conv(id : Int32) -> Conv? {
  for c in convs.get() {
    if c.id == id {
      return Some(c)
    }
  }
  None
}

///|
fn current_conv() -> Conv? {
  find_conv(current.get())
}

///|
fn current_title() -> String {
  match current_conv() {
    Some(c) => c.title.get()
    None => "New chat"
  }
}

///|
fn model_name() -> String {
  let id = model.get()
  for m in models {
    if m.id == id {
      return m.name
    }
  }
  "Parley Swift"
}

///|
fn say(s : String) -> Unit {
  status.set(s)
}

// ---------------------------------------------------------------------------
// Scrolling

///|
fn at_bottom() -> Bool {
  let sc = scroller.val
  if @js.is_nullish(sc) {
    return true
  }
  let top : Double = sc._get("scrollTop").cast()
  let h : Double = sc._get("scrollHeight").cast()
  let ch : Double = sc._get("clientHeight").cast()
  h - top - ch < 48.0
}

///|
fn scroll_to_end() -> Unit {
  let sc = scroller.val
  if !@js.is_nullish(sc) {
    sc._set("scrollTop", sc._get("scrollHeight"))
  }
  pinned.set(true)
}

///|
/// New text follows the end only while the reader is already there.
fn follow() -> Unit {
  if pinned.get() {
    let sc = scroller.val
    if !@js.is_nullish(sc) {
      sc._set("scrollTop", sc._get("scrollHeight"))
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming

///|
fn is_space(c : Char) -> Bool {
  c == ' ' || c == '\n' || c == '\t'
}

///|
/// The end of the next `words` words after `from`: a fixed step, so the stream is deterministic.
fn next_cut(t : String, from : Int32, words : Int32) -> Int32 {
  let cs : Array[Char] = t.iter().collect()
  let n = cs.length()
  let mut i = from
  let mut w = 0
  while w < words && i < n {
    while i < n && is_space(cs[i]) {
      i = i + 1
    }
    while i < n && !is_space(cs[i]) {
      i = i + 1
    }
    w = w + 1
  }
  i
}

///|
fn finish(m : Msg) -> Unit {
  m.streaming.set(false)
  busy.set(false)
  active.val = None
  timer.val = -1
  follow()
}

///|
fn tick() -> Unit {
  match active.val {
    None => ()
    Some(m) => {
      let t = m.text.get()
      let cut = next_cut(t, m.shown.get(), words_per_tick)
      m.shown.set(cut)
      follow()
      if cut >= t.length() {
        finish(m)
      } else {
        timer.val = set_timeout(tick, tick_ms)
      }
    }
  }
}

///|
fn start_stream(m : Msg) -> Unit {
  @resource.batch(fn() {
    m.stopped.set(false)
    m.feedback.set(0)
    m.streaming.set(true)
    m.shown.set(0)
    busy.set(true)
  })
  active.val = Some(m)
  if instant.val {
    m.shown.set(m.text.get().length())
    finish(m)
  } else {
    timer.val = set_timeout(tick, tick_ms)
  }
}

///|
fn stop_stream() -> Unit {
  match active.val {
    None => ()
    Some(m) => {
      if timer.val >= 0 {
        clear_timeout(timer.val)
      }
      timer.val = -1
      active.val = None
      @resource.batch(fn() {
        m.streaming.set(false)
        m.stopped.set(true)
        busy.set(false)
      })
      follow()
      say("Stopped")
    }
  }
}

// ---------------------------------------------------------------------------
// Sending

///|
fn short_title(text : String) -> String {
  if text.length() <= 42 {
    return text
  }
  let cut = text.substring(end=42)
  match cut.rev_find(" ") {
    Some(i) if i > 20 => cut.substring(end=i) + "…"
    _ => cut + "…"
  }
}

///|
fn clear_prompt() -> Unit {
  draft.set("")
  let el = prompt_el.val
  if !@js.is_nullish(el) {
    el._set("value", @js.any(""))
    el._get("style")._set("height", @js.any(""))
  }
}

///|
fn send_text(raw : String) -> Unit {
  let text = raw.trim().to_string()
  if text == "" || busy.get() {
    return
  }
  let conv = match current_conv() {
    Some(c) => c
    None => {
      let c : Conv = {
        id: fresh_id(),
        title: @resource.signal(short_title(text)),
        group: "Today",
        messages: @resource.signal([]),
      }
      let list = [c]
      for o in convs.get() {
        list.push(o)
      }
      convs.set(list)
      current.set(c.id)
      c
    }
  }
  let u = new_msg("user", text, true)
  let a = new_msg("assistant", pick_reply(text), false)
  conv.messages.update(fn(ms) {
    let n = ms.copy()
    n.push(u)
    n.push(a)
    n
  })
  clear_prompt()
  scroll_to_end()
  start_stream(a)
}

///|
fn open_conv(id : Int32) -> Unit {
  stop_stream()
  current.set(id)
  set_drawer(false)
  row_menu.set(-1)
  set_timeout(fn() { scroll_to_end() }, 0) |> ignore
}

///|
fn new_chat() -> Unit {
  stop_stream()
  current.set(-1)
  set_drawer(false)
  clear_prompt()
  later_focus("#prompt")
}

///|
fn close_menus() -> Unit {
  model_open.set(false)
  attach_open.set(false)
  row_menu.set(-1)
}

///|
fn remove_conv(id : Int32) -> Unit {
  convs.set(convs.get().filter(fn(c) { c.id != id }))
  if current.get() == id {
    new_chat()
  }
}
