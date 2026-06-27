# Detective Files
# Application SDK

Version: 1.0

---

# Overview

Every feature inside Detective Files is an application.

Applications run inside the Police Workstation.

Applications are independent plugins.

The workstation never contains gameplay.

Gameplay exists only inside applications.

---

# Goals

Applications must be:

Independent

Reusable

Replaceable

Lazy Loaded

Data Driven

Easy to Maintain

---

# Folder Structure

Every application lives inside:

/apps/

Example

/apps/police-mail/

Contents

app.json

index.js

style.css

assets/ (optional)

README.md (optional)

Example

/apps

    /police-mail

        app.json

        index.js

        style.css

        assets/

---

# Required Files

Every application must provide

app.json

index.js

style.css

Nothing else is required.

---

# app.json

The workstation discovers applications using app.json.

Example

{
    "id": "mail",
    "title": "Police Mail",
    "icon": "mail.png",
    "version": "1.0.0",
    "singleton": true,
    "resizable": false,
    "width": 820,
    "height": 620,
    "minimumWidth": 600,
    "minimumHeight": 400
}

---

# Required Fields

id

Unique application id.

Never change after release.

title

Displayed in:

Desktop

Taskbar

Window

Start Menu

icon

Pixel icon.

singleton

Only one instance allowed.

Future support may allow false.

width

Default width.

height

Default height.

---

# BaseApp

Every application extends BaseApp.

Example

class PoliceMail extends BaseApp
{

}

Never create standalone applications.

---

# Application Lifecycle

Every application should implement

create()

Called once.

Create DOM.

Load UI.

Open()

Application becomes visible.

close()

Window closed.

minimize()

Window hidden.

restore()

Window restored.

destroy()

Application removed from memory.

---

# Optional Lifecycle

onFocus()

onBlur()

onResize()

onThemeChanged()

onSave()

onRestore()

These may be added later.

---

# Responsibilities

Applications manage

Their UI

Their Data

Their Events

Their State

Applications never manage

Desktop

Taskbar

Window Position

Storage

Other Applications

---

# Window Access

Applications never manipulate windows directly.

Incorrect

window.style.left

window.style.top

Correct

WindowManager.move(...)

WindowManager.close(...)

WindowManager.focus(...)

Applications request.

Managers execute.

---

# Communication

Applications never call each other.

Incorrect

Messenger.open()

Correct

EventBus.emit()

Example

EventBus.emit("mail:new")

---

# Storage

Applications never access

localStorage

Correct

StorageManager.save()

StorageManager.load()

---

# Styling

Every application owns its stylesheet.

Never edit global styles.

Use scoped class names.

Example

.mail-window

.mail-sidebar

.mail-item

Avoid

.container

.content

.item

.button

---

# HTML

Applications generate their own DOM.

Avoid writing HTML directly inside index.html.

Each application owns its interface.

---

# Assets

Place application assets inside

assets/

Example

/apps

    /mail

        assets

            icon.png

            logo.png

            folder.png

Applications never reference assets from another application.

---

# Events

Applications subscribe only while active.

Remove listeners when destroyed.

Avoid memory leaks.

---

# Data

Application data should remain private.

Expose only public APIs when required.

Never modify another application's data.

---

# Configuration

Anything configurable belongs inside JSON.

Examples

Default folders

Window title

Toolbar buttons

Application settings

Future layouts

---

# Performance

Applications should:

Create DOM only once.

Reuse elements.

Cache queries.

Destroy unused resources.

Lazy load heavy data.

---

# Error Handling

Never fail silently.

Use meaningful messages.

Example

Unable to load Police Mail configuration.

Never

Error.

---

# Accessibility

Readable text.

Keyboard ready.

Meaningful labels.

Consistent navigation.

---

# Future Compatibility

Applications should support

Themes

Localization

Cloud Save

Online Accounts

Window Resizing

Plugin Updates

Without major rewrites.

---

# Example Skeleton

class PoliceMail extends BaseApp
{

    create()
    {

    }

    open()
    {

    }

    close()
    {

    }

    minimize()
    {

    }

    restore()
    {

    }

    destroy()
    {

    }

}

---

# Application Checklist

✓ app.json exists

✓ index.js exists

✓ style.css exists

✓ Extends BaseApp

✓ Uses EventBus

✓ Uses StorageManager

✓ Uses WindowManager

✓ No Global Variables

✓ No Direct LocalStorage

✓ No Direct Communication

✓ Scoped CSS

✓ Clean Lifecycle

---

# Golden Rule

Applications should behave like software installed on a real operating system.

The workstation provides the environment.

Applications provide the functionality.

Neither should depend on the internal implementation of the other.