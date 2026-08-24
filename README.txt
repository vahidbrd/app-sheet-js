# Sheet Panel

A lightweight, dependency-free bottom/top sheet component for modern web applications.

Supports touch and mouse dragging, responsive height, overlay, internal scrolling, browser history, and a simple JavaScript API.

## Features

* Bottom Sheet and Top Sheet
* Touch and mouse drag support
* Drag to expand, collapse, or close
* Smooth animations
* Configurable minimum and maximum height
* Responsive to viewport resize
* Mobile keyboard/`visualViewport` support
* Internal content scrolling
* Overlay with click-to-close
* Browser Back button support
* Multiple sheets with only one active sheet at a time
* Global JavaScript API
* No JavaScript dependencies
* Works with Tailwind CSS or regular CSS



Then include the stylesheet and JavaScript according to your build setup.

## Basic HTML

```html
<button
    type="button"
    data-sheet="musicSheet"
>
    Open Music
</button>

<div
    class="sheet"
    id="musicSheet"
    data-sheet-side="bottom"
    data-sheet-min-height="300"
    data-sheet-max-height="70"
>
    <div class="p-5">
        <div class="overflow-y-auto">
            Your content here...
        </div>
    </div>
</div>
```

Initialize the JavaScript after the sheet markup is available:

```html
<script src="js/app-sheet.js"></script>
```

## Opening a Sheet

### Using a data attribute

```html
<button data-sheet="musicSheet">
    Open Music
</button>
```

The value of `data-sheet` must match the sheet's `id`.

### Using JavaScript

```html
<script>
    openSheet("musicSheet");
</script>
```

## JavaScript API

### Open

```javascript
openSheet("musicSheet");
```

### Close

```javascript
closeSheet("musicSheet");
```

### Toggle

```javascript
toggleSheet("musicSheet");
```

You can also access the methods directly through the sheet element:

```javascript
const sheet = document.getElementById("musicSheet");

sheet.open();
sheet.close();
sheet.toggle();
```

## Data Attributes

### `data-sheet-side`

Controls the sheet position.

```html
data-sheet-side="bottom"
```

Available values:

```text
bottom
top
```

Default:

```text
bottom
```

### `data-sheet-min-height`

Defines the minimum sheet height in pixels.

```html
data-sheet-min-height="300"
```

### `data-sheet-max-height`

Defines the maximum sheet height as a percentage of the viewport height.

```html
data-sheet-max-height="70"
```

For example:

```html
data-sheet-max-height="70"
```

means the sheet can grow up to approximately `70vh`.

## Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Sheet Panel</title>

    <script src="https://cdn.tailwindcss.com"></script>
</head>

<body>

<button
    type="button"
    data-sheet="musicSheet"
    class="btn btn-primary"
>
    Open Music
</button>

<div
    class="sheet"
    id="musicSheet"
    data-sheet-side="bottom"
    data-sheet-min-height="300"
    data-sheet-max-height="70"
>
    <div class="p-5">

        <div class="overflow-y-auto">
            Your content goes here.
        </div>

    </div>
</div>

<script src="js/app-sheet.js"></script>

</body>
</html>
```

## Content Scrolling

The first child of `.sheet` is used as the panel.

The first suitable child inside the panel becomes the scrollable content area.

For long content, use:

```html
<div class="overflow-y-auto">
    ...
</div>
```

The sheet handle remains fixed while the content can scroll independently.

The component also applies the required scrolling behavior automatically.

## Handle

A drag handle is automatically created by the component.

For a bottom sheet, the handle appears at the top:

```text
┌─────────────────────┐
│        ─────        │
│                     │
│       Content       │
│                     │
└─────────────────────┘
```

For a top sheet, the handle appears at the bottom.

The handle is always available for dragging.

## Drag Behavior

### Bottom Sheet

* Drag up → expand
* Drag down → collapse/close
* Fast downward drag → close
* Drag beyond the maximum height → rubber-band effect
* Drag below the minimum height → rubber-band effect

### Top Sheet

* Drag down → expand
* Drag up → collapse/close
* Fast upward drag → close
* Same rubber-band behavior at the limits

## Overlay

An overlay is automatically created when a sheet opens.

Clicking the overlay closes the active sheet.

No additional overlay HTML is required.

The overlay is managed internally by the component.

## Browser Back Button

Opening a sheet creates a browser history state.

Therefore:

```text
Open Sheet
    ↓
Browser Back
    ↓
Sheet closes
```

This makes the component suitable for mobile applications and SPA-style interfaces.

## Multiple Sheets

Multiple `.sheet` elements can exist on the same page.

```html
<div
    class="sheet"
    id="musicSheet"
    data-sheet-side="bottom"
>
    ...
</div>

<div
    class="sheet"
    id="settingsSheet"
    data-sheet-side="top"
>
    ...
</div>
```

Only one sheet can be active at a time.

Opening another sheet automatically closes the currently active sheet.

## Styling

The component automatically adds the required structural classes to the sheet and panel.

The panel receives:

```text
sheet-panel
```

Additional styling can be applied directly to `.sheet-panel`.

Example:

```css
.sheet-panel {
    background: white;
}
```

The default border radius is:

```text
Bottom Sheet: 28px 28px 0 0
Top Sheet:    0 0 28px 28px
```

When the sheet reaches the full viewport height, the border radius is automatically removed.

## Responsive Behavior

The sheet recalculates its dimensions when the viewport changes.

It also listens to:

```javascript
window.visualViewport
```

when available.

This is useful on mobile devices when the virtual keyboard changes the available viewport height.

## Configuration Example

```html
<div
    class="sheet"
    id="settingsSheet"
    data-sheet-side="top"
    data-sheet-min-height="250"
    data-sheet-max-height="85"
>
    <div class="p-5">
        Settings content
    </div>
</div>
```

This creates a top sheet with:

* Minimum height: `250px`
* Maximum height: `85%` of viewport height
* Drag support
* Overlay
* Internal scrolling
* Browser history support

## Requirements

* Modern browser with Pointer Events support
* JavaScript enabled
* Tailwind CSS is optional

The component itself does not require Tailwind CSS, although the example markup uses Tailwind utility classes.

## Public API

```javascript
openSheet(id);
closeSheet(id);
toggleSheet(id);
```

Example:

```javascript
openSheet("settingsSheet");

closeSheet("settingsSheet");

toggleSheet("settingsSheet");
```


## Events

The Sheet emits four lifecycle events:

```javascript
sheet:open
sheet:close
```

Example:

```javascript
const sheet = document.getElementById("musicSheet");

sheet.addEventListener("sheet:open", () => {
    console.log("Opening...");
});



sheet.addEventListener("sheet:close", () => {
    console.log("Closing...");
});


```

`sheet:open` and `sheet:close` fire when the opening/closing process starts.

Each event provides information through `event.detail`, including:

```javascript
event.detail.id
event.detail.side
event.detail.height
event.detail.minHeight
event.detail.maxHeight
event.detail.sheet
```


## License

MIT
