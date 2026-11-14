// The Share dialog, opened from a card's menu and from the watch page.

///|
let share_video : @resource.Signal[String] = @resource.signal("")

///|
let share_at : @resource.Signal[Int] = @resource.signal(0)

///|
let share_from : @resource.Signal[Bool] = @resource.signal(false)

///|
let share_copied : @resource.Signal[Bool] = @resource.signal(false)

///|
fn open_share(v : Video, at : Int) -> Unit {
  @resource.batch(fn() {
    share_video.set(v.id)
    share_at.set(at)
    share_from.set(false)
    share_copied.set(false)
  })
  js_show_dialog("share")
}

///|
fn share_link() -> String {
  let base = "https://reelhouse.example/watch?v=\{share_video.get()}"
  if share_from.get() {
    "\{base}&t=\{share_at.get()}"
  } else {
    base
  }
}

///|
fn share_dialog() -> @element.DomNode {
  dialog("share", "Share", [
    @element.label(for_="share-link", class="field-label") <| [@element.text("Video link")],
    @element.div(class="share-row") <| [
      @element.input(
        type_="text",
        id="share-link",
        class="text-field",
        readonly_=true,
        dyn_value=share_link,
        on=@element.events().focus(fn(e) { ignore((js_current_target(any_of(e)))._call("select", [])) }),
      ),
      @element.button(
        class="btn btn-primary",
        on=@element.events().click(fn(_e) {
          js_copy(share_link())
          share_copied.set(true)
        }),
      ) <| [@element.text_dyn(fn() { if share_copied.get() { "Copied" } else { "Copy" } })],
    ],
    @element.label(class="check-row") <| [
      @element.input(
        type_="checkbox",
        id="share-start",
        dyn_checked=fn() { share_from.get() },
        on=@element.events().change(fn(_e) {
          share_from.update(fn(b) { !b })
          share_copied.set(false)
        }),
      ),
      @element.span() <| [@element.text_dyn(fn() { "Start at \{fmt_time(share_at.get())}" })],
    ],
  ])
}
