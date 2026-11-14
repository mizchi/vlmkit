# Brief: code hosting — "Forgeyard"

- **Directory**: `examples/sites/code/`
- **Pattern**: interactive app — a repository home, file view and issue list
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Forgeyard**, a fictional code-hosting site. It shows one fictional repository, `tidewater/lantern`:
an open-source static site generator with 4.2k stars. One page, `index.html`, with three views
chosen by the hash:

- `#/`: the repository home (Code);
- `#/blob/<path>`: a file;
- `#/issues`: the issue list.

The repository's tree has about 25 entries in nested folders. The text of 6 files and the README is
seeded in the program. Everything is fixed data, and times are written as text ("2 hours ago").

## Reference study

The pattern is the big code-hosting site. Measured at 1280×800:

- A black global header about 68px tall: the logo mark, nav menus (Products, Developers,
  Businesses, Resources, Pricing), a search field showing a "/" key hint, "Sign in" and "Sign up".
- The repo header: owner / name, then tabs (Code, Issues 27, Pull requests 11, Actions, Security,
  Insights). The current tab is underlined in orange. Counters are grey pills.
- The repo title row: an icon, the name and a "Public" pill on the left; Notifications, Fork 6.9k
  and Star 100k on the right, as bordered buttons with counters.
- The main column, about 900px:
  - a branch button, "232 Branches · 170 Tags", "Go to file" and a green "Code" button;
  - a bordered file table, whose header row has the latest commit: avatar, author, message, short
    SHA, age and a commit count;
  - rows with a folder or file icon, the name, the last commit message (with linked PR numbers)
    and the age.
- A right column about 270px wide: About (description, link, topic chips, Readme, License, …).
- The **Code menu** is a 400px popover with a "Clone" header, HTTPS and CLI tabs, a read-only URL
  field with a copy button, "Clone using the web URL." and "Download ZIP".

## Layout and behaviour

- **Global header**:
  - The nav menus are disclosure menus.
  - The search field opens a command-palette dialog. Pressing "/" anywhere opens it too, unless
    you are typing in a field.
  - The palette searches files and issues, and the arrow keys and Enter navigate its results.
- **Repo header**: as in the reference study.
  - Star toggles to "Starred" and its count moves by 1. Watch opens a menu (Participating, All
    activity, Ignore, Custom). Fork opens a dialog.
  - The tabs are links to the views. Issues 23 and Pull requests 4 show counters.
- **Code view**:
  - The branch selector is a popover with a filter field and Branches / Tags tabs (8 branches,
    5 tags). Choosing one changes the label and the latest-commit line.
  - "Go to file" is a filter field: typing filters the tree to a flat list of matching paths,
    with the matched characters in bold.
  - The Code menu is as in the reference study. Copy writes to the clipboard when the browser
    allows it, and either way the button shows a "Copied!" tooltip.
  - The file table: clicking a folder descends into it, with a breadcrumb and a ".." row. Clicking
    a file opens the blob view.
  - Below the table, the README renders: headings, paragraphs, a badge row, a fenced code block
    with its own copy button, a table, a task list and an "Outline" menu of the headings.
  - Right column:
    - About: the description, a link, 6 topic chips, and Readme, License, Activity and Stars links.
    - Releases: the latest, with a "Latest" badge.
    - Contributors: avatars.
    - Languages: a stacked bar plus a legend with percentages.
- **Blob view**:
  - The breadcrumb path, and the latest commit for the file.
  - Code / Blame tabs. Blame shows commit chunks beside the lines, from seeded data.
  - A toolbar with "Raw", "Copy raw file", "Download" and the line count and size.
  - The code has line numbers and simple syntax colouring: keywords, strings, comments.
  - Clicking a line number highlights the line and sets `#L12` in the URL. Shift-click extends
    the selection to a range.
  - A symbols pane on the right lists the functions, and clicking one jumps to it.
- **Issues view**:
  - The search field holds `is:issue is:open`.
  - Filter menus: Author, Label, Projects, Milestones, Assignees and Sort.
  - "23 Open / 41 Closed" toggles.
  - Rows show an open or closed icon, the title, coloured label chips (legible text on any chip
    colour), "#123 opened 3 days ago by user" and a comment count.
  - A "New issue" button opens a form with a Title and a Markdown body with Write / Preview tabs.
    Submitting adds the issue to the top of the list as #124.
- **Theme**: light by default, dark under `prefers-color-scheme: dark` or `?theme=dark`. Both pass
  AA, including the label chips.
- **Phones**:
  - The header becomes a hamburger, the logo, and search and sign-in icons.
  - The repo tabs scroll horizontally.
  - The file table drops the commit-message column.
  - The About panel moves above the file table.
  - The blob view wraps long lines with a toggle ("Wrap lines").

## Required copy

```
Forgeyard
tidewater/lantern
Public
Star
Starred
Go to file
Code
Issues
Pull requests
Clone
Download ZIP
README.md
New issue
```

## States to show (final round)

- The repository home at desktop and mobile sizes.
- The Code menu open.
- The branch selector filtered.
- "Go to file" with matches.
- A folder opened.
- A file with a line range highlighted.
- The Blame tab.
- The command palette open.
- The issue list.
- The new-issue form in Preview.
- Starred.
- Dark theme.

## Gates this brief leans on

- `check interactions`: menus, popovers, tabs, the palette and the "/" shortcut.
- `check a11y focus` and `check a11y contrast`, in both themes and on the label chips.
- `check design`: buttons and counters stay consistent.
- `check composition`: the file table rail and the header hierarchy.
- `check color`.
- `check breakpoints --sweep`: the About panel move and the table column drop.
- `check scroll` / `scan scroll`: the tabs and code scrollers.
- `verify flow`: open a file, highlight lines, go back.
- `stress data`: long file names, many issues.
