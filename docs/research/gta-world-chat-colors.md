# GTA World chat colors and line formats

Research date: 2026-09-25

## Scope and source quality

GTA World's server source is not public, and I did not find an official machine-readable palette. The strongest available color evidence is therefore the latest color-reference post in the official GTA World forum's Aesthetic Guides section. It was published in October 2025 and explicitly presents itself as up to date. An older 2019 guide is useful as corroboration and as evidence that at least one value changed over time. For line formats, the official forum's Server Script Guides and verbatim chatlogs posted on the GTA World forum provide stronger evidence than third-party parsers.

## Bottom line

The current implementation only matches GTA World's documented `/me` and `/do` purple. Its other five presets differ from the latest GTA World forum reference. Several inference rules also target forms that GTA World does not normally emit, so authentic pasted chatlogs will often be misclassified or left uncolored.

The highest-value corrections are:

1. Replace the five mismatched preset values.
2. Recognize timestamps before classifying a line.
3. Match `says [low]:`, `says (phone):` / `says (cellphone):`, `shouts:`, directed speech, and GTA World's actual transaction sentences.
4. Accept the `!{#RRGGBB}` inline tokens found in exported GTA World chatlogs in addition to the editor's existing `{RRGGBB}` syntax.
5. Split “item / money” into transaction green and inventory yellow; GTA World uses different colors for them.

## Palette comparison

The latest GTA World forum guide lists the following palette: `/me` and `/do` `#c2a3da`, normal speech `#f1f1f1`, low speech `#adadad`, whisper `#eda841`, phone-call speech `#fbf724`, item-given and money-paid messages `#56d64b`, inventory items `#ffff00`, radio `#ece3a7`, HQ messages `#006eff`, phone incoming/outgoing notices `#ffff00`, intercom and CK blue `#3896f3`, and CK red `#f00000` ([2025 GTA World Aesthetic Guide](https://forum.gta.world/en/topic/150630-up-to-date-samp-style-800x600-1-font-guide/)).

| Type | Current `TEXT_COLOR_PRESETS` | Latest GTA World guide | Assessment |
|---|---:|---:|---|
| `/me` | `#c2a3da` | `#c2a3da` | Match |
| `/do` | `#c2a3da` | `#c2a3da` | Match |
| Normal speech | `#ffffff` | `#f1f1f1` | Wrong |
| Low speech | `#d0d0d0` | `#adadad` | Wrong |
| Whisper | `#ffff00` | `#eda841` | Wrong; yellow is used for other message types |
| Phone-call speech | `#ffff99` | `#fbf724` | Wrong |
| Item / money | `#33aa33` | `#56d64b` for item given / money paid | Wrong and too broadly grouped |
| Inventory item | not present | `#ffff00` | Missing |
| Radio | not present | `#ece3a7` | Missing |
| HQ message | not present | `#006eff` | Missing |
| Phone incoming/outgoing notice | not present | `#ffff00` | Missing |
| Intercom / CK blue | not present | `#3896f3` | Missing |
| CK red | not present | `#f00000` | Missing |

The older guide agrees on `/me`, `/do`, normal speech, whisper, phone, CK, and inventory colors, but gives transaction green as `#49ad49` rather than the newer `#56d64b` ([2019 GTA World LSRP+ guide](https://forum.gta.world/en/topic/18804-guide-using-lsrp/)). That difference is evidence that hard-coded colors can change and that the 2025 value should be preferred for present behavior.

## Line-format comparison

### Timestamps prevent all current inference

Verbatim GTA World logs commonly begin with `[HH:MM:SS]`, including normal speech, actions, low speech, phone speech, and shouts ([actual low/speech/action log](https://forum.gta.world/en/topic/153286-temptation-bay-season-two-episode-six-18/), [actual phone log](https://forum.gta.world/en/profile/42514-mrrighthanz/content/?type=forums_topic_post), [actual directed-shout log](https://forum.gta.world/en/profile/62910-lxrddanone/content/page/35/?type=forums_topic_post)). `inferredLineColor` anchors every rule at the beginning of the string and does not strip a timestamp, so none of those raw lines match.

### `/me` and `/do`

The documented output shapes are:

- `/me`: `* Firstname Lastname action`
- `/do`: `* description (( Firstname Lastname ))`
- Exported local action: `> Firstname Lastname action`

The official basic-commands guide shows the first two forms, including spaces inside `/do`'s double parentheses ([GTA World basic commands](https://forum.gta.world/en/topic/6410-basic-commands/)). Exported logs posted to the forum also use `>` for the local player's action ([GTA World screenshot-editor post](https://forum.gta.world/en/profile/24371-zgazenamacka/content/?type=forums_topic_post), [phone/radio transcript](https://forum.gta.world/en/profile/1345-robbie/content/page/4/?type=forums_topic_post)). The current `/do` regex requires `((Firstname Lastname))` without those spaces, so it misses the documented form. The generic name-plus-text fallback recognizes `* Name ...` after timestamps are removed but not `> Name ...`; it is also broad enough to misclassify unknown speech forms as `/me`.

Related action commands that should share purple include `/my`, `/melow`, `/melong`, `/dolow`, `/dolong`, and `/ame`; GTA World's beginner guide documents these as variants of `/me` or `/do` ([GTA World beginner guide](https://forum.gta.world/en/topic/54796-guide-the-beginners-ultimate-guide/)). `/ame` is normally overhead-only, so whether it appears in a pasted log depends on the log source.

### Normal, directed, low, and shouted speech

Observed/documented forms include:

- `Firstname Lastname says: text`
- `Firstname Lastname says (to Firstname Lastname): text`
- `Firstname Lastname says [low]: text`
- `Firstname Lastname shouts: text`
- `Firstname Lastname shouts (to Firstname Lastname): text`

The basic-commands guide explicitly documents `says [low]:` and `shouts:` ([GTA World basic commands](https://forum.gta.world/en/topic/6410-basic-commands/)). A recent forum transcript demonstrates directed `says (to Name):`, while another demonstrates directed `shouts (to Name):` ([directed-speech transcript](https://forum.gta.world/en/topic/153286-temptation-bay-season-two-episode-six-18/), [directed-shout transcript](https://forum.gta.world/en/profile/62910-lxrddanone/content/page/35/?type=forums_topic_post)).

The current normal-speech rule happens to accept both `says:` and `says (to ...)` because it stops at the word `says`. However:

- The low rule looks for `says quietly` or `murmurs`, not GTA World's documented `says [low]:`, so real low speech falls through to normal white.
- There is no shout rule. A shout line reaches the generic name fallback and becomes `/me` purple.

### Whispers

Actual forum chatlogs use `Firstname Lastname whispers: text`; one posted raw-looking log also prefixes every whisper with `!{#FEB822}` ([GTA World report transcript](https://forum.gta.world/en/profile/42318-iasonas69420/content/?change_section=1&type=forums_topic_post)). A recent GTA World forum tool changelog independently calls the in-game whisper color orange and handles `whispers:` as speech ([GTAW Chat Tool forum topic](https://forum.gta.world/en/topic/163208-gtaw-chat-tool-screenshot-editor/)).

The current `whispers` pattern is structurally correct once an optional timestamp/color token is handled, but its preset yellow is wrong according to both the latest palette guide and the forum tool. There is a color ambiguity: the 2025 guide says `#eda841`, while the 2024 pasted log contains `!{#FEB822}`. The guide is newer and should be the preset default; an explicit token in pasted text should always win.

### Phone and loudspeaker speech

Current GTA World transcripts contain:

- `Firstname Lastname says (phone): text`
- `Firstname Lastname says (cellphone): text`
- `Firstname Lastname says (loudspeaker): text`
- `(Phone - Loudspeaker) Firstname Lastname says: text`
- `[PHONE] ...` system notifications

These forms appear in verbatim forum logs ([phone and loudspeaker transcript](https://forum.gta.world/en/profile/103646-glazeme/content/?type=forums_topic_post), [cellphone transcript](https://forum.gta.world/en/profile/7727-b%C3%A9n%C3%A9dictine/content/page/39/?type=forums_topic_post)). The current phone rule matches `says (phone)` but not `says (cellphone)`, `says (loudspeaker)`, or `(Phone - Loudspeaker) ...`. Its `[phone]` shortcut conflates system notifications with phone-call speech, although the palette guide assigns those two categories different yellows.

### Items and money

Authentic lines are sentences rather than `[Item]` or `[Money]` tags. Examples include:

- `You paid $2,000 to Firstname Lastname ...`
- `Firstname Lastname paid you $3,000 ...`
- `You have shown Firstname Lastname (M) your Smoking Pipe.`
- `You took 1 Smoking Pipe from the vehicle.`
- `Info: You took Marijuana (1) from the Zipbag.`

A GTA World forum post for a screenshot editor reproduces these chatlog forms ([GTA World screenshot-editor post](https://forum.gta.world/en/profile/24371-zgazenamacka/content/?type=forums_topic_post)). The current `[item]` / `[money]` rule therefore misses the common forms. It also merges two different palette categories: transfer/give messages are green, while an item appearing in inventory is yellow according to the 2025 guide.

### Inline color tokens

The parser currently accepts only `{RRGGBB}`. GTA World forum chatlog evidence contains `!{#RRGGBB}` before colored lines, for example `!{#FEB822}Firstname Lastname whispers: ...` ([GTA World report transcript](https://forum.gta.world/en/profile/42318-iasonas69420/content/?change_section=1&type=forums_topic_post)). The current regex leaves that token visible and, because the token precedes the name, prevents inference. Supporting both syntaxes is safer; an explicit token should override heuristic classification.

## Missing categories worth adding

These are ordered by likely screenshot usefulness and confidence:

1. **Shout**: high confidence; documented and common. It appears to be a speech subtype, but the available palette guide does not assign it a separate color, so normal speech `#f1f1f1` is the conservative default.
2. **Inventory vs transaction**: high confidence; the guide explicitly assigns separate yellow and green values, and common line forms are available.
3. **Radio**: high confidence color (`#ece3a7`), but multiple radio/faction formats exist. A real log shows `** [S: 1 | CH: BASE] Firstname Lastname says: ...` ([radio transcript](https://forum.gta.world/en/profile/1345-robbie/content/page/4/?type=forums_topic_post)). This should be its own parser family rather than another name fallback.
4. **Phone notification, loudspeaker, and SMS**: high confidence that these are distinct from ordinary phone-call speech; exact subtypes should be introduced independently so one yellow does not swallow them all.
5. **OOC (`/b`, `/o`, `/pm`)**: the basic-commands guide documents forms such as `(( (52) Firstname Lastname: text ))` and `(( PM to ... ))`, but the color reference does not give their colors. Add recognition only after obtaining reliable color evidence or expose a configurable preset.
6. **HQ, intercom, and CK/system messages**: the colors are documented in the 2025 palette guide, but exact matching should be based on representative pasted lines before implementation.

## Recommended implementation order

1. Update the existing five incorrect colors and split transaction/inventory.
2. Normalize only for classification: remove an optional timestamp and recognized leading color token while preserving the original displayed text and run offsets.
3. Add tests using exact forum-observed strings, especially `/do` spacing, `[low]`, directed speech, shout, `(phone)` / `(cellphone)`, money, inventory, and `!{#...}`.
4. Add radio, phone-system, and other system categories behind separate presets once representative examples are collected.

This order fixes incorrect output for the common roleplay lines without letting broad system-message heuristics create false positives.
