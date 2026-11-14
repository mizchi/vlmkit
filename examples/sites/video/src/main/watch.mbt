// The watch page (watch.html?v=<id>): the player, the video's details, the
// description, comments and the up-next column.

///|
extern "js" fn js_is_fullscreen() -> Bool =
  #|() => !!document.fullscreenElement

///|
extern "js" fn js_blur_active() -> Unit =
  #|() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

///|
extern "js" fn js_set_title(t : String) -> Unit =
  #|(t) => { document.title = t; }

///|
extern "js" fn js_focus_visible_within(el : @js.Any) -> Bool =
  #|(el) => { const f = document.activeElement; return !!f && el.contains(f) && f.matches(":focus-visible"); }

///|
fn clamp01(x : Double) -> Double {
  if x < 0.0 {
    0.0
  } else if x > 1.0 {
    1.0
  } else {
    x
  }
}

///|
fn pct(x : Double) -> String {
  "\{n1(clamp01(x) * 100.0)}%"
}

///|
fn up_next_for(v : Video) -> Array[Video] {
  let same = videos.filter(fn(o) { o.id != v.id && o.topic.key() == v.topic.key() })
  let other = videos.filter(fn(o) { o.id != v.id && o.topic.key() != v.topic.key() })
  let out = same + other
  let res : Array[Video] = []
  for i = 0; i < 12 && i < out.length(); i = i + 1 {
    res.push(out[i])
  }
  res
}

///|
struct Player {
  v : Video
  time : @resource.Signal[Double]
  playing : @resource.Signal[Bool]
  muted : @resource.Signal[Bool]
  volume : @resource.Signal[Int]
  cc : @resource.Signal[Bool]
  theater : @resource.Signal[Bool]
  speed : @resource.Signal[Double]
  pointer_active : @resource.Signal[Bool]
  focus_in : @resource.Signal[Bool]
  hover : @resource.Signal[Double]
  reduced : @resource.Signal[Bool]
  fullscreen : @resource.Signal[Bool]
  autoplay : @resource.Signal[Bool]
  next_href : String
  mut last_frame : Double
  mut hide_timer : Int
  mut dragging : Bool
  mut el : @js.Any?
}

///|
fn Player::dur(self : Player) -> Double {
  self.v.duration.to_double()
}

///|
fn Player::seek(self : Player, t : Double) -> Unit {
  let d = self.dur()
  self.time.set(if t < 0.0 { 0.0 } else if t > d { d } else { t })
}

///|
fn Player::frame(self : Player, ts : Double) -> Unit {
  if !self.playing.get() {
    return
  }
  if self.last_frame >= 0.0 {
    let dt = (ts - self.last_frame) / 1000.0 * self.speed.get()
    let next = self.time.get() + dt
    if next >= self.dur() {
      @resource.batch(fn() {
        self.time.set(self.dur())
        self.playing.set(false)
      })
      if self.autoplay.get() {
        js_navigate(self.next_href)
      }
      return
    }
    self.time.set(next)
  }
  self.last_frame = ts
  ignore(js_raf(fn(t) { self.frame(t) }))
}

///|
fn Player::play(self : Player) -> Unit {
  if self.playing.get() {
    return
  }
  if self.time.get() >= self.dur() {
    self.time.set(0.0)
  }
  self.playing.set(true)
  self.last_frame = -1.0
  self.poke()
  ignore(js_raf(fn(t) { self.frame(t) }))
}

///|
fn Player::pause(self : Player) -> Unit {
  self.playing.set(false)
}

///|
fn Player::toggle(self : Player) -> Unit {
  if self.playing.get() {
    self.pause()
  } else {
    self.play()
  }
}

///|
/// The pointer moved: show the controls, and hide them 2.5s later.
fn Player::poke(self : Player) -> Unit {
  self.pointer_active.set(true)
  if self.hide_timer >= 0 {
    js_clear_timeout(self.hide_timer)
  }
  self.hide_timer = js_set_timeout(fn() { self.pointer_active.set(false) }, 2500)
}

///|
fn Player::controls_shown(self : Player) -> Bool {
  !self.playing.get() || self.focus_in.get() || self.pointer_active.get()
}

///|
fn Player::sec(self : Player) -> Int {
  self.time.get().to_int()
}

///|
fn Player::toggle_fullscreen(self : Player) -> Unit {
  match self.el {
    Some(el) => js_fullscreen(el)
    None => ()
  }
}

///|
fn Player::keydown(self : Player, a : @js.Any) -> Unit {
  if js_mod_key(a) {
    return
  }
  let tag = js_target_tag(a)
  if tag.has_prefix("menuitem") || tag == "input" || tag == "textarea" {
    return
  }
  let on_button = tag == "button" || tag == "a"
  let on_slider = tag == "slider"
  let key = js_key(a)
  let handled = match key {
    " " | "Spacebar" =>
      if on_button {
        false
      } else {
        self.toggle()
        true
      }
    "k" | "K" => {
      self.toggle()
      true
    }
    "j" | "J" => {
      self.seek(self.time.get() - 10.0)
      true
    }
    "l" | "L" => {
      self.seek(self.time.get() + 10.0)
      true
    }
    "ArrowLeft" =>
      if on_slider {
        false
      } else {
        self.seek(self.time.get() - 5.0)
        true
      }
    "ArrowRight" =>
      if on_slider {
        false
      } else {
        self.seek(self.time.get() + 5.0)
        true
      }
    "m" | "M" => {
      self.muted.update(fn(m) { !m })
      true
    }
    "c" | "C" => {
      self.cc.update(fn(c) { !c })
      true
    }
    "f" | "F" => {
      self.toggle_fullscreen()
      true
    }
    "t" | "T" => {
      self.theater.update(fn(t) { !t })
      true
    }
    k =>
      if k.length() == 1 && k >= "0" && k <= "9" {
        let n = k.code_unit_at(0).to_int() - 48
        self.seek(self.dur() * n.to_double() / 10.0)
        true
      } else {
        false
      }
  }
  if handled {
    js_prevent(a)
  }
}

///|
fn ctrl_button(
  label : () -> String,
  content : () -> String,
  action : () -> Unit,
  pressed~ : (() -> Bool)? = None,
  class~ : String = "ctrl",
) -> @element.DomNode {
  let dyn_attrs = [dattr("aria-label", label)]
  let dyn_attrs = match pressed {
    Some(p) => dyn_attrs + [dattr("aria-pressed", fn() { bool_s(p()) })]
    None => dyn_attrs
  }
  @element.button(
    class~,
    dyn_attrs~,
    on=@element.events().click(fn(_e) { action() }),
  ) <| [
    @element.span(class="ctrl-icon") <| [
      @element.show(fn() { content() == "a" }, fn() { icon("play") }),
      @element.show(fn() { content() == "b" }, fn() { icon("pause") }),
    ],
  ]
}

///|
fn icon_button(
  label : () -> String,
  name : String,
  action : () -> Unit,
  pressed~ : (() -> Bool)? = None,
  class~ : String = "ctrl",
  tip~ : String = "",
) -> @element.DomNode {
  let dyn_attrs = [dattr("aria-label", label)]
  let dyn_attrs = match pressed {
    Some(p) => dyn_attrs + [dattr("aria-pressed", fn() { bool_s(p()) })]
    None => dyn_attrs
  }
  let attrs = if tip == "" { [] } else { [sattr("data-tip", tip)] }
  @element.button(
    class~,
    attrs~,
    dyn_attrs~,
    on=@element.events().click(fn(_e) { action() }),
  ) <| [icon(name)]
}

///|
fn scrubber(p : Player) -> @element.DomNode {
  let v = p.v
  let d = p.dur()
  let n = v.chapters.length()
  let buffered = fn() {
    let t = p.time.get()
    let ahead = if d * 0.12 > 20.0 { d * 0.12 } else { 20.0 }
    if t + ahead > d { d } else { t + ahead }
  }
  let segments = v.chapters.mapi(fn(i, c) {
    let s = c.start.to_double()
    let e = if i + 1 < n { v.chapters[i + 1].start.to_double() } else { d }
    let w = (e - s) / d * 100.0
    @element.span(class="seg", style="flex: \{n1(w)} 1 0%") <| [
      @element.span(class="seg-buffer", dyn_style=fn() { "width: \{pct((buffered() - s) / (e - s))}" }) <| [],
      @element.span(class="seg-play", dyn_style=fn() { "width: \{pct((p.time.get() - s) / (e - s))}" }) <| [],
    ]
  })
  let seek_to = fn(a : @js.Any) {
    let el = js_current_target(a)
    let f = js_rect_fraction(el, js_client_x(a))
    p.seek(f * d)
    p.hover.set(f)
  }
  @element.div(
    class="scrubber",
    attrs=[
      sattr("role", "slider"),
      sattr("tabindex", "0"),
      sattr("aria-label", "Seek"),
      sattr("aria-valuemin", "0"),
      sattr("aria-valuemax", v.duration.to_string()),
    ],
    dyn_attrs=[
      dattr("aria-valuenow", fn() { p.sec().to_string() }),
      dattr("aria-valuetext", fn() {
        let s = p.sec()
        "\{fmt_time(s)} of \{fmt_time(v.duration)}, \{v.chapters[chapter_index(v, s)].name}"
      }),
    ],
    on=@element.events()
      .pointerdown(fn(e) {
        let a = any_of(e)
        p.dragging = true
        js_capture(js_current_target(a), js_pointer_id(a))
        seek_to(a)
      })
      .pointermove(fn(e) {
        let a = any_of(e)
        let f = js_rect_fraction(js_current_target(a), js_client_x(a))
        p.hover.set(f)
        if p.dragging {
          p.seek(f * d)
        }
      })
      .pointerup(fn(_e) { p.dragging = false })
      .pointercancel(fn(_e) { p.dragging = false })
      .pointerleave(fn(_e) { if !p.dragging { p.hover.set(-1.0) } })
      .keydown(fn(e) {
        let a = any_of(e)
        let step = match js_key(a) {
          "ArrowLeft" | "ArrowDown" => -5.0
          "ArrowRight" | "ArrowUp" => 5.0
          "PageDown" => -d / 10.0
          "PageUp" => d / 10.0
          "Home" => -d
          "End" => d
          _ => 0.0
        }
        if step != 0.0 {
          js_prevent(a)
          p.seek(p.time.get() + step)
        }
      }),
  ) <| [
    @element.span(class="segs") <| segments,
    @element.span(class="knob", dyn_style=fn() { "left: \{pct(p.time.get() / d)}" }) <| [],
    @element.show(fn() { p.hover.get() >= 0.0 }, fn() {
      @element.span(
        class="scrub-tip",
        attrs=[sattr("aria-hidden", "true")],
        dyn_style=fn() {
          let f = p.hover.get()
          let f = if f < 0.06 { 0.06 } else if f > 0.94 { 0.94 } else { f }
          "left: \{pct(f)}"
        },
      ) <| [
        @element.span(class="scrub-tip-chapter") <| [
          @element.text_dyn(fn() {
            let s = (p.hover.get() * d).to_int()
            v.chapters[chapter_index(v, s)].name
          }),
        ],
        @element.span(class="scrub-tip-time") <| [
          @element.text_dyn(fn() { fmt_time((p.hover.get() * d).to_int()) }),
        ],
      ]
    }),
  ]
}

///|
fn player_view(p : Player) -> @element.DomNode {
  let v = p.v
  // The picture at 0:00 is the thumbnail's; reduced motion holds it there.
  let t0 = still(v)()
  let scene_t = fn() {
    if p.reduced.get() {
      t0
    } else {
      t0 + p.time.get()
    }
  }
  let speed_item = fn(label : String, s : Double) {
    radio(label, fn() { p.speed.get() == s }, fn() { p.speed.set(s) })
  }
  @element.div(
    id="player",
    attrs=[
      sattr("tabindex", "0"),
      sattr("role", "region"),
      sattr("aria-label", "Video player. Press k to play or pause"),
      sattr("aria-keyshortcuts", "k j l m c f t"),
    ],
    dyn_class=fn() {
      let base = if p.controls_shown() { "player controls-on" } else { "player" }
      let base = if p.playing.get() { "\{base} is-playing" } else { base }
      if p.time.get() == 0.0 && !p.playing.get() { "\{base} is-fresh" } else { base }
    },
    ref_=fn(el) {
      let a = element_any(el)
      p.el = Some(a)
      // Keyboard focus keeps the controls up; a mouse click that focuses a
      // button (no :focus-visible) does not, or they would never auto-hide.
      js_on(a, "focusin", fn(_e) { later(fn() { p.focus_in.set(js_focus_visible_within(a)) }) })
      js_on(a, "focusout", fn(_e) { later(fn() { p.focus_in.set(js_focus_visible_within(a)) }) })
      js_on(a, "keyup", fn(_e) { p.focus_in.set(js_focus_visible_within(a)) })
    },
    on=@element.events()
      .keydown(fn(e) { p.keydown(any_of(e)) })
      .pointermove(fn(_e) { p.poke() })
      .mouseleave(fn(_e) { if p.playing.get() { p.pointer_active.set(false) } })
      .click(fn(e) {
        let a = any_of(e)
        let t = a._get("target")
        // Only a click on the picture itself toggles playback. (Testing "not in
        // the controls" failed: a control's icon is re-rendered by its own click,
        // so by the time the event bubbles here the target is detached and
        // closest(".controls") finds nothing.)
        if js_closest(t, ".player-scene, .captions") {
          p.toggle()
        }
      }),
  ) <| [
    scene(v, scene_t, class="scene player-scene"),
    @element.show(fn() { p.cc.get() }, fn() {
      @element.div(class="captions", attrs=[sattr("aria-live", "off")]) <| [
        @element.span() <| [@element.text_dyn(fn() { caption_at(v, p.sec()) })],
      ]
    }),
    @element.button(
      class="big-play",
      attrs=[sattr("aria-label", "Play video"), sattr("tabindex", "-1")],
      on=@element.events().click(fn(_e) { p.play() }),
    ) <| [icon("play-lg")],
    @element.div(class="controls") <| [
      scrubber(p),
      @element.div(class="ctrl-row") <| [
        ctrl_button(
          fn() { if p.playing.get() { "Pause (k)" } else { "Play (k)" } },
          fn() { if p.playing.get() { "b" } else { "a" } },
          fn() { p.toggle() },
          class="ctrl ctrl-play",
        ),
        @element.a(
          href=p.next_href,
          class="ctrl ctrl-next",
          attrs=[sattr("aria-label", "Next video")],
        ) <| [icon("next")],
        @element.div(class="volume") <| [
          @element.button(
            class="ctrl",
            dyn_attrs=[
              dattr("aria-label", fn() { if p.muted.get() { "Unmute (m)" } else { "Mute (m)" } }),
            ],
            on=@element.events().click(fn(_e) { p.muted.update(fn(m) { !m }) }),
          ) <| [
            @element.show(fn() { p.muted.get() || p.volume.get() == 0 }, fn() { icon("muted") }),
            @element.show(fn() { !(p.muted.get() || p.volume.get() == 0) }, fn() { icon("volume") }),
          ],
          @element.input(
            type_="range",
            class="vol",
            attrs=[
              sattr("min", "0"),
              sattr("max", "100"),
              sattr("step", "5"),
              sattr("aria-label", "Volume"),
            ],
            dyn_value=fn() { if p.muted.get() { "0" } else { p.volume.get().to_string() } },
            on=@element.events().input(fn(e) {
              let s = js_target_value(any_of(e))
              let n = parse_digits(s)
              p.volume.set(n)
              p.muted.set(n == 0)
            }),
          ),
        ],
        @element.span(class="time") <| [
          @element.text_dyn(fn() { "\{fmt_time(p.sec())} / \{fmt_time(v.duration)}" }),
        ],
        @element.span(class="chapter-name") <| [
          @element.text_dyn(fn() { "· \{v.chapters[chapter_index(v, p.sec())].name}" }),
        ],
        @element.span(class="ctrl-spacer") <| [],
        icon_button(fn() { "Subtitles/closed captions (c)" }, "cc", fn() { p.cc.update(fn(c) { !c }) }, pressed=Some(fn() { p.cc.get() })),
        menu_button(
          "speed",
          "Playback speed",
          [icon("settings")],
          [
            speed_item("0.5×", 0.5),
            speed_item("Normal", 1.0),
            speed_item("1.5×", 1.5),
            speed_item("2×", 2.0),
          ],
          trigger_class="ctrl",
          menu_class="menu menu-up",
          heading="Playback speed",
        ),
        icon_button(
          fn() { if p.theater.get() { "Default view (t)" } else { "Theater mode (t)" } },
          "theater",
          fn() { p.theater.update(fn(t) { !t }) },
          pressed=Some(fn() { p.theater.get() }),
          class="ctrl ctrl-theater",
        ),
        icon_button(
          fn() { if p.fullscreen.get() { "Exit full screen (f)" } else { "Full screen (f)" } },
          "fullscreen",
          fn() { p.toggle_fullscreen() },
        ),
      ],
    ],
  ]
}

///|
fn chapter_links(p : Player, after : () -> Unit) -> @element.DomNode {
  let v = p.v
  @element.ol(class="chapters") <| v.chapters.map(fn(c) {
    @element.li() <| [
      @element.a(
        href="watch.html?v=\{v.id}&t=\{c.start}",
        class="chapter-link",
        on=@element.events().click(fn(e) {
          js_prevent(any_of(e))
          p.seek(c.start.to_double())
          after()
          js_focus("#player")
        }),
      ) <| [
        @element.span(class="chapter-time") <| [@element.text(fmt_time(c.start))],
        @element.span() <| [@element.text(c.name)],
      ],
    ]
  })
}

///|
fn description_box(p : Player) -> @element.DomNode {
  let v = p.v
  let open = @resource.signal(false)
  @element.section(
    dyn_class=fn() { if open.get() { "desc open" } else { "desc" } },
    attrs=[sattr("aria-label", "Description")],
  ) <| [
    @element.p(class="desc-meta") <| [
      @element.text("\{with_commas(v.views)} views · \{v.date}"),
    ],
    @element.div(id="desc-text", class="desc-text") <| [
      @element.p() <| [@element.text(description_of(v))],
      @element.show(fn() { open.get() }, fn() {
        @element.fragment([
          @element.h3(class="desc-heading") <| [@element.text("Chapters")],
          chapter_links(p, fn() { () }),
        ])
      }),
    ],
    @element.button(
      class="more",
      attrs=[sattr("aria-controls", "desc-text")],
      dyn_attrs=[dattr("aria-expanded", fn() { bool_s(open.get()) })],
      on=@element.events().click(fn(_e) {
        if !open.get() && js_matches("(max-width: 599px)") {
          js_show_dialog("desc-sheet")
        } else {
          open.update(fn(o) { !o })
        }
      }),
    ) <| [@element.text_dyn(fn() { if open.get() { "Show less" } else { "...more" } })],
  ]
}

///|
fn description_sheet(p : Player) -> @element.DomNode {
  let v = p.v
  dialog(
    "desc-sheet",
    "Description",
    [
      @element.p(class="desc-meta") <| [@element.text("\{with_commas(v.views)} views · \{v.date}")],
      @element.p() <| [@element.text(description_of(v))],
      @element.h3(class="desc-heading") <| [@element.text("Chapters")],
      chapter_links(p, fn() { js_close_dialog("desc-sheet") }),
    ],
    class="dialog sheet",
  )
}

///|
fn channel_row(v : Video) -> @element.DomNode {
  let ch = channel_of(v)
  let subscribed = @resource.signal(false)
  let bell = @resource.signal("all")
  let bell_item = fn(label : String, key : String) {
    radio(label, fn() { bell.get() == key }, fn() {
      bell.set(key)
      toast("Notifications: \{label}")
    })
  }
  @element.div(class="channel-row") <| [
    avatar(ch, class="avatar avatar-lg"),
    @element.div(class="channel-text") <| [
      @element.p(class="channel-name") <| [@element.text(ch.name)],
      @element.p(class="channel-subs") <| [@element.text(ch.subs)],
    ],
    @element.show(fn() { !subscribed.get() }, fn() {
      @element.button(
        id="sub-btn",
        class="btn btn-subscribe",
        on=@element.events().click(fn(_e) {
          subscribed.set(true)
          toast("Subscription added")
          later(fn() { js_focus("#bell-btn") })
        }),
      ) <| [@element.text("Subscribe")]
    }),
    @element.show(fn() { subscribed.get() }, fn() {
      menu_button(
        "bell",
        "Subscribed. Notifications",
        [icon("bell"), @element.span() <| [@element.text("Subscribed")], icon("down", class="icon icon-sm")],
        [
          bell_item("All", "all"),
          bell_item("Personalized", "personalized"),
          bell_item("None", "none"),
          item("Unsubscribe", "hide", fn() {
            subscribed.set(false)
            toast("Subscription removed")
            later(fn() { js_focus("#sub-btn") })
          }),
        ],
        trigger_class="btn btn-tonal btn-subscribed",
      )
    }),
  ]
}

///|
fn rating(v : Video) -> @element.DomNode {
  let state = @resource.signal(0)
  let likes = v.views / 37 + v.seed % 300
  let dislikes = v.views / 2900 + v.seed % 40
  @element.div(class="segmented", attrs=[sattr("role", "group"), sattr("aria-label", "Rate this video")]) <| [
    @element.button(
      class="seg-btn",
      dyn_attrs=[dattr("aria-pressed", fn() { bool_s(state.get() == 1) })],
      on=@element.events().click(fn(_e) { state.update(fn(s) { if s == 1 { 0 } else { 1 } }) }),
    ) <| [
      icon("like"),
      @element.span(class="sr-only") <| [@element.text("Like, ")],
      @element.span() <| [
        @element.text_dyn(fn() { with_commas(likes + (if state.get() == 1 { 1 } else { 0 })) }),
      ],
    ],
    @element.button(
      class="seg-btn",
      dyn_attrs=[dattr("aria-pressed", fn() { bool_s(state.get() == -1) })],
      on=@element.events().click(fn(_e) { state.update(fn(s) { if s == -1 { 0 } else { -1 } }) }),
    ) <| [
      icon("dislike"),
      @element.span(class="sr-only") <| [@element.text("Dislike, ")],
      @element.span() <| [
        @element.text_dyn(fn() { with_commas(dislikes + (if state.get() == -1 { 1 } else { 0 })) }),
      ],
    ],
  ]
}

///|
fn save_dialog() -> @element.DomNode {
  let lists = ["Watch later", "Space nights", "Kitchen ideas", "Long train rides"]
  dialog("save", "Save video to…", [
    @element.ul(class="checklist") <| lists.mapi(fn(i, name) {
      @element.li() <| [
        @element.label(class="check-row") <| [
          @element.input(type_="checkbox", id="pl-\{i}", checked=i == 1),
          @element.span() <| [@element.text(name)],
        ],
      ]
    }),
    @element.div(class="dialog-actions") <| [
      @element.button(
        class="btn btn-primary",
        on=@element.events().click(fn(_e) {
          js_close_dialog("save")
          toast("Playlists updated")
        }),
      ) <| [@element.text("Done")],
    ],
  ])
}

///|
fn comment_avatar(author : String) -> @element.DomNode {
  let initial = author.view(start_offset=1, end_offset=2).to_string().to_upper()
  let h = hash(author) % 360
  @element.span(
    class="avatar avatar-sm",
    style="background: hsl(\{h} 50% 30%)",
    attrs=[sattr("aria-hidden", "true"), sattr("data-initial", initial)],
  ) <| []
}

///|
fn comments_section(v : Video) -> @element.DomNode {
  let list = @resource.signal(seed_comments(v))
  let sort = @resource.signal("top")
  let composing = @resource.signal(false)
  let draft = @resource.signal("")
  let open_replies : @resource.Signal[Array[Int]] = @resource.signal([])
  let liked : @resource.Signal[Array[Int]] = @resource.signal([])
  let next_id : Ref[Int] = { val: 100 }
  let sorted = @resource.memo(fn() {
    let all = list.get().copy()
    let s = sort.get()
    all.sort_by(fn(a, b) {
      let mine = (if b.order < 0 { 1 } else { 0 }).compare(if a.order < 0 { 1 } else { 0 })
      if mine != 0 {
        mine
      } else if s == "top" {
        b.likes.compare(a.likes)
      } else {
        a.order.compare(b.order)
      }
    })
    all
  })
  let total = fn() {
    let mut n = 0
    for c in list.get() {
      n = n + 1 + c.replies.length()
    }
    n
  }
  let cancel = fn() {
    js_set_value("#comment-input", "")
    draft.set("")
    composing.set(false)
  }
  let submit = fn() {
    let text = draft.get().trim(chars=" ").to_string()
    if text != "" {
      next_id.val = next_id.val + 1
      let mine : Comment = {
        id: next_id.val,
        author: "@you",
        age: "just now",
        order: -next_id.val,
        text,
        likes: 0,
        replies: [],
      }
      list.update(fn(l) { [mine] + l })
      cancel()
      toast("Comment added")
    }
  }
  @element.section(class="comments", attrs=[sattr("aria-labelledby", "comments-title")]) <| [
    @element.div(class="comments-head") <| [
      @element.h2(id="comments-title", class="comments-title") <| [
        @element.text_dyn(fn() { "\{total()} Comments" }),
      ],
      menu_button(
        "sort",
        "Sort comments",
        [icon("sort"), @element.span() <| [@element.text("Sort by")]],
        [
          radio("Top comments", fn() { sort.get() == "top" }, fn() { sort.set("top") }),
          radio("Newest first", fn() { sort.get() == "new" }, fn() { sort.set("new") }),
        ],
        trigger_class="btn btn-text",
      ),
    ],
    @element.div(class="composer") <| [
      @element.span(
        class="avatar avatar-sm avatar-you",
        attrs=[sattr("aria-hidden", "true"), sattr("data-initial", "Y")],
      ) <| [],
      @element.div(class="composer-main") <| [
        @element.label(
          for_="comment-input",
          dyn_class=fn() { if composing.get() || draft.get() != "" { "comment-ph is-hidden" } else { "comment-ph" } },
        ) <| [@element.text("Add a comment...")],
        @element.input(
          type_="text",
          id="comment-input",
          class="comment-input",
          attrs=[sattr("autocomplete", "off")],
          on=@element.events()
            .focus(fn(_e) { composing.set(true) })
            .input(fn(e) { draft.set(js_target_value(any_of(e))) })
            .keydown(fn(e) {
              let a = any_of(e)
              match js_key(a) {
                "Enter" => {
                  js_prevent(a)
                  submit()
                }
                "Escape" => {
                  cancel()
                  js_blur_active()
                }
                _ => ()
              }
            }),
        ),
        @element.show(fn() { composing.get() }, fn() {
          @element.div(class="composer-actions") <| [
            @element.button(
              class="btn btn-text",
              on=@element.events().click(fn(_e) { cancel() }),
            ) <| [@element.text("Cancel")],
            @element.button(
              class="btn btn-primary",
              dyn_disabled=fn() { draft.get().trim(chars=" ").to_string() == "" },
              on=@element.events().click(fn(_e) { submit() }),
            ) <| [@element.text("Comment")],
          ]
        }),
      ],
    ],
    @element.ul(class="comment-list") <| [
      @element.for_each(fn() { sorted() }, fn(c, _i) {
        let is_open = fn() { open_replies.get().contains(c.id) }
        let is_liked = fn() { liked.get().contains(c.id) }
        @element.li(class=if c.order < 0 { "comment mine" } else { "comment" }) <| [
          comment_avatar(c.author),
          @element.div(class="comment-main") <| [
            @element.p(class="comment-head") <| [
              @element.span(class="comment-author") <| [@element.text(c.author)],
              @element.span(class="comment-age") <| [@element.text(c.age)],
            ],
            @element.p(class="comment-text") <| [@element.text(c.text)],
            @element.div(class="comment-actions") <| [
              @element.button(
                class="btn-mini",
                dyn_attrs=[dattr("aria-pressed", fn() { bool_s(is_liked()) })],
                on=@element.events().click(fn(_e) {
                  liked.update(fn(l) { if l.contains(c.id) { l.filter(fn(x) { x != c.id }) } else { l + [c.id] } })
                }),
              ) <| [
                icon("like", class="icon icon-sm"),
                @element.span(class="sr-only") <| [@element.text("Like comment, ")],
                @element.span() <| [
                  @element.text_dyn(fn() { compact(c.likes + (if is_liked() { 1 } else { 0 })) }),
                ],
              ],
            ],
            if c.replies.length() > 0 {
              @element.fragment([
                @element.button(
                  class="replies-toggle",
                  attrs=[sattr("aria-controls", "replies-\{c.id}")],
                  dyn_attrs=[dattr("aria-expanded", fn() { bool_s(is_open()) })],
                  on=@element.events().click(fn(_e) {
                    open_replies.update(fn(l) {
                      if l.contains(c.id) { l.filter(fn(x) { x != c.id }) } else { l + [c.id] }
                    })
                  }),
                ) <| [
                  icon("down", class="icon icon-sm chev"),
                  @element.text(if c.replies.length() == 1 { "1 reply" } else { "\{c.replies.length()} replies" }),
                ],
                @element.ul(id="replies-\{c.id}", class="replies", dyn_attrs=[dattr("data-open", fn() { bool_s(is_open()) })]) <| [
                  @element.show(is_open, fn() {
                    @element.fragment(c.replies.map(fn(r) {
                      let (author, age, text) = r
                      @element.li(class="comment reply") <| [
                        comment_avatar(author),
                        @element.div(class="comment-main") <| [
                          @element.p(class="comment-head") <| [
                            @element.span(class="comment-author") <| [@element.text(author)],
                            @element.span(class="comment-age") <| [@element.text(age)],
                          ],
                          @element.p(class="comment-text") <| [@element.text(text)],
                        ],
                      ]
                    }))
                  }),
                ],
              ])
            } else {
              @element.fragment([])
            },
          ],
        ]
      }),
    ],
  ]
}

///|
fn up_next(v : Video, autoplay : @resource.Signal[Bool]) -> @element.DomNode {
  @element.aside(class="upnext", attrs=[sattr("aria-labelledby", "upnext-title")]) <| [
    @element.div(class="upnext-head") <| [
      @element.h2(id="upnext-title", class="upnext-title") <| [@element.text("Up next")],
      @element.label(class="switch-row") <| [
        @element.span(id="autoplay-label") <| [@element.text("Autoplay")],
        @element.button(
          class="switch",
          attrs=[sattr("role", "switch"), sattr("aria-labelledby", "autoplay-label")],
          dyn_attrs=[dattr("aria-checked", fn() { bool_s(autoplay.get()) })],
          on=@element.events().click(fn(_e) { autoplay.update(fn(a) { !a }) }),
        ) <| [@element.span(class="switch-knob") <| []],
      ],
    ],
    @element.ul(class="next-list") <| up_next_for(v).map(fn(o) {
      let ch = channel_of(o)
      @element.li(class="next-row") <| [
        @element.a(href=watch_href(o), class="next-link") <| [
          @element.span(class="thumb next-thumb") <| [scene(o, still(o)), badge(o)],
          @element.span(class="next-text") <| [
            @element.span(class="next-title") <| [@element.text(o.title)],
            @element.span(class="next-channel") <| [@element.text(ch.name)],
            @element.span(class="next-meta") <| meta_parts(o),
          ],
        ],
      ]
    }),
  ]
}

///|
fn watch_page() -> Unit {
  let v = find_video(js_url_param("v"))
  let animate_off = js_url_param("animate") == "0"
  let t_param = js_url_param("t")
  let start = if animate_off || t_param == "" {
    0.0
  } else {
    parse_digits(t_param).to_double()
  }
  let reduced = @resource.signal(false)
  reduced.set(js_media("(prefers-reduced-motion: reduce)", fn(m) { reduced.set(m) }))
  let nexts = up_next_for(v)
  let p : Player = {
    v,
    time: @resource.signal(if start > v.duration.to_double() { 0.0 } else { start }),
    playing: @resource.signal(false),
    muted: @resource.signal(false),
    volume: @resource.signal(80),
    cc: @resource.signal(false),
    theater: @resource.signal(false),
    speed: @resource.signal(1.0),
    pointer_active: @resource.signal(false),
    focus_in: @resource.signal(false),
    hover: @resource.signal(-1.0),
    reduced,
    fullscreen: @resource.signal(false),
    autoplay: @resource.signal(!animate_off),
    next_href: watch_href(nexts[0]),
    last_frame: -1.0,
    hide_timer: -1,
    dragging: false,
    el: None,
  }
  js_on_document("fullscreenchange", fn(_e) { p.fullscreen.set(js_is_fullscreen()) })
  js_set_title("\{v.title} · Reelhouse")
  mount("masthead", masthead(""))
  mount("guide-root", guide("", false))
  mount("app", @element.div(
    class="watch",
    dyn_class=fn() { if p.theater.get() { "watch theater" } else { "watch" } },
  ) <| [
    @element.div(class="player-area") <| [player_view(p)],
    @element.div(class="primary") <| [
      @element.h1(class="watch-title") <| [@element.text(v.title)],
      @element.div(class="watch-bar") <| [
        channel_row(v),
        @element.div(class="watch-actions") <| [
          rating(v),
          @element.button(
            class="btn btn-tonal",
            on=@element.events().click(fn(_e) { open_share(v, p.sec()) }),
          ) <| [icon("share"), @element.span() <| [@element.text("Share")]],
          @element.button(
            class="btn btn-tonal",
            on=@element.events().click(fn(_e) { js_show_dialog("save") }),
          ) <| [icon("save"), @element.span() <| [@element.text("Save")]],
        ],
      ],
      description_box(p),
      comments_section(v),
    ],
    @element.div(class="secondary") <| [up_next(v, p.autoplay)],
    toast_region(),
    site_dialogs(),
    share_dialog(),
    save_dialog(),
    description_sheet(p),
  ])
}

///|
fn parse_digits(s : String) -> Int {
  let mut n = 0
  for i = 0; i < s.length(); i = i + 1 {
    let c = s.code_unit_at(i).to_int()
    if c < 48 || c > 57 {
      return n
    }
    n = n * 10 + (c - 48)
  }
  n
}
