# Detective Files
# Coding Style Guide

Version: 1.0

---

# Purpose

This document defines the coding standards for Detective Files.

Every source file must follow these rules.

Consistency is more important than personal preference.

The goal is long-term maintainability.

---

# General Principles

Write code for humans first.

Code should be easy to read.

Code should be easy to extend.

Code should be easy to debug.

Avoid clever code.

Prefer explicit solutions.

---

# JavaScript Standard

Language

ECMAScript 2023+

Use ES6 Modules.

Never use inline JavaScript.

Never use global variables.

Avoid anonymous functions unless very small.

---

# File Size

Target

200–400 lines

Maximum

600 lines

If a file grows larger, split it.

---

# Class Size

Target

150–300 lines

Maximum

500 lines

Large classes should be decomposed.

---

# Function Size

Target

10–25 lines

Maximum

40 lines

Functions should do one thing.

---

# Single Responsibility Principle

Each class has one responsibility.

Example

WindowManager

Responsible only for window behavior.

Bad

WindowManager

Managing windows

Saving settings

Loading applications

Updating themes

Good

Separate managers.

---

# Naming

Use descriptive names.

Good

WindowManager

StorageManager

DesktopManager

ApplicationLoader

Bad

Manager

App

Util2

Temp

Helper

Stuff

---

# Variables

Good

currentWindow

windowPosition

desktopIcons

applicationList

Bad

x

y

tmp

obj

list2

---

# Constants

Use UPPER_SNAKE_CASE.

Example

DEFAULT_WINDOW_WIDTH

MAX_Z_INDEX

DOUBLE_CLICK_DELAY

---

# Methods

Use verbs.

Examples

openWindow()

closeWindow()

loadApplications()

saveDesktop()

restoreWindows()

Avoid

window()

app()

thing()

---

# Boolean Variables

Prefix with

is

has

can

should

Examples

isOpen

hasFocus

canResize

shouldSave

---

# Folder Structure

Never mix unrelated logic.

Core

Managers

UI

Utils

Apps

Data

Each folder owns its purpose.

---

# Imports

Order

External

Core

Managers

Utils

Local

Alphabetically whenever practical.

---

# Comments

Comment why.

Do not comment what.

Bad

// increment x

x++

Good

// Skip duplicate events caused by rapid clicking.

---

# Documentation

Every public class should include

Purpose

Responsibilities

Public methods

Dependencies

Example

/**
 * WindowManager
 *
 * Responsible for creating and managing application windows.
 */

---

# Error Handling

Never ignore errors.

Bad

catch {}

Good

catch(error)
{
    console.error(error);
}

Provide useful messages.

---

# Console

Allowed

console.error()

console.warn()

console.info()

Avoid

console.log()

Except during development.

---

# Magic Numbers

Forbidden.

Bad

window.style.left = 473;

Good

const DEFAULT_MARGIN = 16;

---

# CSS Rules

No inline CSS.

Every application owns its stylesheet.

Use CSS variables.

Never repeat colors.

---

# CSS Variables

Everything reusable should become a variable.

Colors

Spacing

Fonts

Borders

Animation durations

---

# IDs

Avoid IDs.

Prefer classes.

IDs only for unique root elements.

---

# DOM Access

Cache frequently used elements.

Avoid repeatedly calling

querySelector()

inside loops.

---

# Events

Always remove listeners when no longer needed.

Never create memory leaks.

---

# Event Communication

Applications communicate ONLY through EventBus.

Forbidden

mail.open()

Allowed

EventBus.emit()

---

# Storage

Only StorageManager accesses

LocalStorage.

Nobody else.

---

# JSON

Configuration belongs inside JSON.

Never hardcode

Applications

Themes

Desktop Icons

Future Cases

---

# Window Rules

Applications never move windows directly.

Applications request actions.

WindowManager executes them.

---

# Application Rules

Every application extends

BaseApp.

Lifecycle

create()

open()

close()

minimize()

restore()

destroy()

Always call

super()

when required.

---

# Duplication

Rule

Write once.

Reuse forever.

If copied twice

Refactor.

---

# Performance

Minimize DOM updates.

Reuse nodes.

Batch updates.

Cache expensive operations.

Lazy load whenever possible.

---

# Accessibility

Readable names.

Keyboard support ready.

Meaningful labels.

---

# Refactoring

Whenever touching existing code

Leave it cleaner than before.

Never increase technical debt.

---

# Git Style

One feature

One commit

Clear commit messages.

Examples

Add WindowManager dragging

Implement StorageManager

Create BaseApp lifecycle

Bad

fix

update

changes

---

# AI Development Rules

When generating code

Never create giant files.

Never duplicate logic.

Never ignore architecture.

Prefer modular solutions.

Prefer readability over cleverness.

Explain architectural decisions when appropriate.

If a requested implementation conflicts with the architecture

Stop

Explain

Suggest a better solution.

Do not silently violate architecture.

---

# Golden Rule

Every line of code should make the project easier to extend.

Never optimize for today's feature if it makes tomorrow's development harder.