# iOS Accessibility QA Checklist

Issue: #2678

Use this checklist for the manual VoiceOver pass on the Compose Multiplatform iOS app. Run it on a real device when possible; Simulator is acceptable for a first pass, but contrast, Dynamic Type and gesture ergonomics should be confirmed on hardware before closing the issue.

## Setup

- Build the iOS app from `iosApp/iosApp.xcworkspace`.
- Enable VoiceOver.
- Set Larger Text to at least 200%.
- Enable Increase Contrast.
- Test in light and dark mode.
- Use a small iPhone viewport and at least one larger device.

## Screens

| Screen | VoiceOver Names | Focus Order | Headings | Dynamic Type 200% | Contrast |
| --- | --- | --- | --- | --- | --- |
| Splash | App/logo announced once, no decorative duplicates | Enters app without trapped focus | App name is clear | No clipped text | Logo/text remain legible |
| Welcome/Login | Inputs, password toggle and actions are named | Top-to-bottom, primary action after inputs | Main title announced as heading | Inputs/buttons remain usable | Text/buttons meet AA |
| Home | Tabs, quick actions and cards have action labels | Nav and content order are predictable | Section titles are headings | Cards reflow without overlap | Badges/status text meet AA |
| Games | Create game button and game cards are named | List cards read as actionable rows | Screen/list empty states are clear | Game metadata does not clip | Field badges/status contrast OK |
| Game Detail | Back and organizer actions are named | Toolbar before content, related actions grouped | Detail and section titles are headings | Tool rows wrap cleanly | Secondary text readable |
| Invite Players | Search, clear search and invite states are named | Search field before results, result actions last | Screen title clear | Result rows do not overlap | Chips/buttons meet AA |
| Whats New | Back button and expandable versions are named | Version rows read before release content | Screen title is heading | Expanded content wraps cleanly | Release badges/text meet AA |

## Pass Criteria

- Every interactive icon has a useful accessible name.
- Decorative icons use `contentDescription = null`.
- Expand/collapse rows announce the current action.
- Focus order matches visual order and does not enter decorative content.
- Headings let VoiceOver users skim major sections.
- Text remains readable and controls remain reachable at Dynamic Type >= 200%.
- Text contrast meets 4.5:1 and non-text controls/indicators meet 3:1.

## Recording Results

For each failing item, record:

- screen
- device / iOS version
- accessibility setting
- observed VoiceOver phrase or visual issue
- expected phrase or behavior
- screenshot or short screen recording when visual

Link the result back to #2678 before closing the issue.
