// Seed data and canned replies. Everything here is fixed text: no clock, no randomness.

///|
struct Model {
  id : String
  name : String
  desc : String
}

///|
let models : Array[Model] = [
  {
    id: "swift",
    name: "Parley Swift",
    desc: "Fast answers for everyday questions",
  },
  { id: "deep", name: "Parley Deep", desc: "Slower, for harder problems", },
  {
    id: "mini",
    name: "Parley Mini",
    desc: "Lightweight, for short drafts and edits",
  },
]

///|
let groups : Array[String] = ["Today", "Previous 7 days", "Older"]

///|
/// (title, group) for the seeded history; the first one is the open conversation.
let seed_titles : Array[(String, String)] = [
  ("Planning a lunar observation night", "Today"),
  ("Sourdough starter schedule", "Today"),
  ("Rewrite my cover letter intro", "Today"),
  ("Explain CSS container queries", "Previous 7 days"),
  ("Weekend hike packing list", "Previous 7 days"),
  ("Python script to rename photos", "Previous 7 days"),
  ("Gift ideas for a retired teacher", "Previous 7 days"),
  ("Summarize the board meeting notes", "Previous 7 days"),
  ("Learning Portuguese: first 30 days", "Older"),
  ("Fix a leaking kitchen tap", "Older"),
  ("Compare two used bike listings", "Older"),
  ("Birthday party playlist", "Older"),
]

///|
let lunar_q1 : String = "I'm hosting a lunar observation night for our astronomy club on the 14th. About 20 people, three telescopes, and a park on the edge of town. Where do I start?"

///|
let lunar_a1 : String =
  #|Good choice of date: on the 14th the Moon is a **waxing gibbous**, about 78% lit, so it is up from mid-afternoon until well after midnight. That is ideal for a crowd. You want the terminator, the line between day and night, running across interesting terrain, because that is where craters throw long shadows.
  #|
  #|## A plan for the evening
  #|
  #|1. **Scout the park in daylight.** Find a spot with a clear view to the south-east and no street lights pointing at you.
  #|2. **Set up 45 minutes before dusk.** Telescopes need time to cool to the night air, or the image shimmers.
  #|3. **Start with the naked eye.** Point out the dark seas, the maria, before anyone looks through an eyepiece.
  #|4. **Run three stations.** One target per telescope, and rotate the groups every 15 minutes.
  #|
  #|## What to bring
  #|
  #|- Red-light torches, so nobody loses their night vision
  #|- A folding table for the eyepiece case and star charts
  #|- Warm drinks: a clear sky gets cold quickly
  #|- A printed Moon map with **Copernicus**, **Tycho** and **Plato** marked
  #|
  #|If it clouds over, keep a backup: a short talk on why we always see the same face of the Moon goes down well with every age.

///|
let lunar_q2 : String = "Can you compare our three telescopes, and give me a quick script that prints a schedule for the stations?"

///|
let lunar_a2 : String =
  #|Here is how the three compare for lunar work. For the Moon, **magnification and steadiness** matter more than light grasp, since the target is bright.
  #|
  #|| Telescope | Aperture | Best for | Station |
  #||---|---|---|---|
  #|| 8" Dobsonian | 203 mm | Crater detail at 150x | Copernicus |
  #|| 102 mm refractor | 102 mm | Sharp, wide views | The terminator |
  #|| 70 mm travel scope | 70 mm | Kids, quick looks | Whole disc |
  #|
  #|The Dobsonian is the crowd-pleaser, so give it the most interesting crater. Set the refractor on the terminator with a low-power eyepiece, and keep the small scope at the whole disc so younger visitors can find the Moon themselves.
  #|
  #|For the schedule, this prints a rotation for any number of groups. Save it as `stations.py` and run it with Python 3:
  #|
  #|```python
  #|stations = ["Copernicus", "The terminator", "Whole disc"]
  #|groups = ["Red", "Blue", "Green"]
  #|start = 20 * 60 + 15  # 20:15, in minutes
  #|
  #|for slot in range(len(stations)):
  #|    time = start + slot * 15
  #|    print(f"{time // 60:02d}:{time % 60:02d}")
  #|    for i, group in enumerate(groups):
  #|        station = stations[(i + slot) % len(stations)]
  #|        print(f"  {group:<6} -> {station}")
  #|```
  #|
  #|Every group sees all three stations in 45 minutes, and nobody waits in a queue.

///|
let reply_moon : String =
  #|The Moon rewards patience more than equipment. A few things make the biggest difference on the night:
  #|
  #|- **Look along the terminator.** Shadows are longest there, so crater walls and mountain ranges stand out.
  #|- **Use low power first.** Find the target at 40x, then step up to 100x or more once it is centred.
  #|- **Let the eye rest.** Ask each visitor to look for a full minute; detail appears as the eye adapts.
  #|
  #|A good first target for beginners is **Copernicus**, a 93 km crater with terraced walls and a central peak.

///|
let reply_code : String =
  #|Here is a small, readable starting point. It keeps the data separate from the logic, so it is easy to extend later.
  #|
  #|```javascript
  #|const stations = ["Copernicus", "Tycho", "Plato"];
  #|
  #|function rotation(groups, minutes = 15) {
  #|  return stations.map((station, slot) => ({
  #|    at: slot * minutes,
  #|    order: groups.map((g, i) => [g, stations[(i + slot) % stations.length]]),
  #|  }));
  #|}
  #|
  #|console.log(rotation(["Red", "Blue", "Green"]));
  #|```
  #|
  #|Call `rotation` with your own group names. The `minutes` argument sets how long each slot lasts.

///|
let reply_list : String =
  #|Here is a checklist you can work through in order:
  #|
  #|1. **Pick the date** and a backup date in case of cloud.
  #|2. **Book the space** and check whether you need a permit for an evening event.
  #|3. **Send the invitation** two weeks ahead, with what to wear and what to bring.
  #|4. **Confirm the equipment** the week before: telescopes, eyepieces, torches.
  #|5. **Check the forecast** on the morning, and post a go or no-go message by noon.
  #|
  #|Keep the list somewhere everyone helping can see it, and tick items off as they are done.

///|
let reply_table : String =
  #|Here is a side-by-side view of the options:
  #|
  #|| Option | Strength | Trade-off |
  #||---|---|---|
  #|| Parley Swift | Quick answers | Less depth on hard problems |
  #|| Parley Deep | Careful reasoning | Takes longer to reply |
  #|| Parley Mini | Light and short | Best for small edits |
  #|
  #|If you are not sure, start with **Parley Swift** and switch when a question needs more thought.

///|
let reply_default : String =
  #|Happy to help with that. Here is how I would approach it:
  #|
  #|- **Start with the goal.** Write one sentence that says what a good result looks like.
  #|- **List what you already have**, and what is missing.
  #|- **Take the smallest next step**, then check it against the goal.
  #|
  #|If you share a little more detail, such as who it is for and when it is due, I can make this much more specific.

///|
/// The canned reply for a prompt, chosen by its keywords.
fn pick_reply(prompt : String) -> String {
  let p = prompt.to_lower()
  if p.contains("compare") || p.contains("table") || p.contains("versus") {
    reply_table
  } else if p.contains("code") ||
    p.contains("script") ||
    p.contains("function") ||
    p.contains("javascript") {
    reply_code
  } else if p.contains("plan") ||
    p.contains("list") ||
    p.contains("checklist") ||
    p.contains("steps") {
    reply_list
  } else if p.contains("moon") ||
    p.contains("lunar") ||
    p.contains("telescope") ||
    p.contains("crater") {
    reply_moon
  } else {
    reply_default
  }
}

///|
/// The short reply a seeded (not open) conversation shows when it is opened.
fn seeded_reply(title : String) -> String {
  "Picking up where we left off on **" +
  title +
  "**. Last time we agreed on the main points, and I said I would keep the next step short.\n\nTell me what has changed since then, or ask me to summarize the thread so far, and I will take it from there."
}

///|
struct Suggestion {
  title : String
  detail : String
  prompt : String
}

///|
let suggestions : Array[Suggestion] = [
  {
    title: "Plan a star party",
    detail: "a checklist for 20 guests",
    prompt: "Plan a star party for 20 guests and give me a checklist",
  },
  {
    title: "Write a script",
    detail: "that rotates groups between stations",
    prompt: "Write a JavaScript function that rotates groups between stations",
  },
  {
    title: "Compare the models",
    detail: "Swift, Deep and Mini side by side",
    prompt: "Compare the Parley models in a table",
  },
  {
    title: "Explain the terminator",
    detail: "and why craters look sharper there",
    prompt: "Why do lunar craters look sharper near the terminator?",
  },
]
