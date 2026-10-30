import { createGlobalStyle } from "styled-components";
import { tokens } from "@fluentui/react-components";
import { fluentVariables, type ResolvedMode } from "./themePalettes";

const themeCss = (mode: ResolvedMode) =>
  Object.entries(fluentVariables(mode))
    .map(([property, value]) => `${property}: ${value};`)
    .join("\n");

export const GlobalStyles = createGlobalStyle`
:root {
  color-scheme: light;
  ${themeCss("light")}
  --cp-input-border: color-mix(in srgb, var(--cp-border) 72%, var(--cp-surface));
  --cp-motion-fast: 120ms;
  --cp-motion-medium: 200ms;
  --cp-motion-slow: 280ms;
  --cp-motion-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
}

html[data-theme="dark"] {
  color-scheme: dark;
  ${themeCss("dark")}
}

* {
  box-sizing: border-box;
  scrollbar-color: var(--cp-border-strong) var(--cp-surface-soft);
  scrollbar-width: thin;
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: var(--cp-surface-soft);
}

*::-webkit-scrollbar-thumb {
  border: 2px solid var(--cp-surface-soft);
  border-radius: 999px;
  background: var(--cp-border-strong);
}

::selection {
  background: var(--cp-accent-soft);
  color: var(--cp-text);
}

html {
  min-width: 320px;
  min-height: 100%;
  background: var(--cp-bg);
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background: var(--cp-bg);
  color: var(--cp-text);
  font-family: var(--cp-font-family);
  font-size: 14px;
  line-height: 1.45;
}

body.pipeline-drag-active {
  overscroll-behavior: none;
  touch-action: none;
  user-select: none;
}

button,
input,
select {
  color: inherit;
  font: inherit;
}

input,
select,
textarea {
  caret-color: var(--cp-accent);
}

button,
select {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.fui-Button {
  transition:
    background-color var(--cp-motion-fast) ease-out,
    border-color var(--cp-motion-fast) ease-out,
    color var(--cp-motion-fast) ease-out,
    transform var(--cp-motion-fast) var(--cp-motion-ease);
}

.fui-Button:active:not(:disabled) {
  transform: scale(0.98);
}

a {
  color: var(--cp-link);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

a:hover {
  text-decoration-thickness: 2px;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 3px solid var(--cp-link);
  outline-offset: 2px;
}

.fui-Input::after,
.fui-Combobox::after,
.fui-Dropdown::after,
.fui-Select::after,
.fui-Textarea::after {
  display: none;
}

.fui-Input:not(:has([aria-invalid="true"])),
.fui-Combobox:not(:has([aria-invalid="true"])),
.fui-Dropdown:not(:has([aria-invalid="true"])),
.fui-Textarea:not(:has([aria-invalid="true"])),
.fui-Select__select:not([aria-invalid="true"]),
input:not([type="checkbox"]):not([type="radio"]):not([aria-invalid="true"]),
select:not([aria-invalid="true"]),
textarea:not([aria-invalid="true"]) {
  border-color: var(--cp-input-border) !important;
}

.fui-Input:focus-within,
.fui-Combobox:focus-within,
.fui-Dropdown:focus-within,
.fui-Select:focus-within,
.fui-Textarea:focus-within {
  outline: 3px solid var(--cp-link);
  outline-offset: 2px;
}

.fui-Input__input:focus-visible,
.fui-Combobox__input:focus-visible,
.fui-Dropdown__button:focus-visible,
.fui-Select__select:focus-visible,
.fui-Textarea__textarea:focus-visible {
  outline: none;
}

.range-select.fui-Dropdown,
.searchable-select.fui-Combobox {
  width: 100%;
  min-width: 0;
  border-color: var(--cp-input-border);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  transition:
    border-color var(--cp-motion-fast) ease-out,
    background-color var(--cp-motion-fast) ease-out,
    box-shadow var(--cp-motion-fast) ease-out;
}

.searchable-select .fui-Combobox__input {
  height: auto;
  min-width: 0;
  min-height: 0;
  padding-block: 0;
}

.searchable-select:not(
  :has(.fui-Combobox__clearIcon[aria-hidden="false"])
) .fui-Combobox__expandIcon,
.searchable-select .fui-Combobox__clearIcon[aria-hidden="false"] {
  display: grid;
  width: 32px;
  min-width: 32px;
  height: auto;
  align-self: stretch;
  place-items: center;
  margin: 0;
  padding: 0;
}

.searchable-select:has(
  .fui-Combobox__clearIcon[aria-hidden="false"]
) .fui-Combobox__expandIcon {
  display: none;
  width: 0;
  min-width: 0;
  height: 0;
}

.searchable-select
  .fui-Combobox__clearIcon[aria-hidden="false"]:focus-visible {
  outline: 2px solid var(--cp-link);
  outline-offset: -3px;
}

.searchable-select .fui-Combobox__expandIcon svg,
.searchable-select .fui-Combobox__clearIcon svg {
  width: 16px;
  height: 16px;
}

.searchable-select-listbox.fui-Listbox {
  max-height: min(320px, 50vh);
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  background: var(--cp-surface);
  box-shadow: var(--cp-shadow);
  padding: 4px;
  transform-origin: top center;
  animation: dropdown-enter var(--cp-motion-medium) var(--cp-motion-ease) both;
}

.searchable-select-listbox .fui-Option {
  min-height: 36px;
  border-radius: 8px;
  transition:
    background-color var(--cp-motion-fast) ease-out,
    color var(--cp-motion-fast) ease-out,
    transform var(--cp-motion-fast) ease-out;
}

.searchable-select-listbox .fui-Option:hover {
  transform: translateX(2px);
}

.fui-MenuPopover {
  transform-origin: top right;
  animation: dropdown-enter var(--cp-motion-medium) var(--cp-motion-ease) both;
}

.fui-DialogSurface {
  animation: dialog-enter var(--cp-motion-slow) var(--cp-motion-ease) both;
}

@keyframes dropdown-enter {
  from {
    opacity: 0;
  }
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
}

@keyframes drawer-enter {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
}

@keyframes backdrop-enter {
  from {
    opacity: 0;
  }
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

h3 {
  font-size: 16px;
  font-weight: 600;
}

strong {
  font-weight: 600;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-shell {
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  min-height: 100vh;
  transition: grid-template-columns var(--cp-motion-medium) var(--cp-motion-ease);
}

.app-shell.sidebar-collapsed {
  grid-template-columns: 56px minmax(0, 1fr);
}

.content-shell {
  min-width: 0;
  background: var(--cp-bg);
  view-transition-name: dashboard-content;
}

.auth-gate {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: var(--cp-bg);
  padding: 24px;
  view-transition-name: dashboard-content;
}

.auth-gate-card {
  width: min(460px, 100%);
  gap: 16px;
  padding: 28px;
}

.auth-gate-card > p {
  color: var(--cp-text-muted);
}

.auth-gate-card .login-box {
  margin-top: 4px;
  border-top: 0;
  padding-top: 0;
}

.auth-check-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-job-notice {
  white-space: pre-line;
}

.brand,
.topbar-actions,
.account-button,
.input-action,
.station-card-header,
.process-title-line,
.panel-heading,
.section-heading,
.dialog-header,
.dialog-actions,
.data-footer {
  display: flex;
  align-items: center;
}

.brand {
  gap: 12px;
}

.sidebar-brand {
  display: flex;
  flex-shrink: 0;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}

.brand-copy {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.brand-copy .fui-Text {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-mark {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  border-radius: 0.625rem;
  background: transparent;
}

.brand-mark img {
  display: block;
  width: 20px;
  height: 20px;
}

.eyebrow,
.nav-label {
  color: var(--cp-text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topbar-actions {
  gap: 8px;
  margin-left: auto;
}

.range-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cp-text-muted);
}

.range-picker .range-select {
  width: 140px;
  padding-inline-end: 0;
}

.range-select .fui-Dropdown__button {
  min-height: 36px;
}

select,
input {
  min-height: 36px;
  border: 1px solid var(--cp-border-strong);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  padding: 6px 10px;
}

.primary-button,
.secondary-button,
.icon-button,
.account-button,
.nav-button,
.project-button {
  border: 1px solid transparent;
  border-radius: 0.625rem;
  background: transparent;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  font-weight: 600;
}

.primary-button {
  border-color: var(--cp-accent);
  background: var(--cp-accent);
  color: var(--cp-accent-fg);
}

.primary-button:hover {
  border-color: var(--cp-accent-hover);
  background: var(--cp-accent-hover);
  color: var(--cp-accent-fg);
}

.primary-button:active {
  border-color: var(--cp-accent-pressed);
  background: var(--cp-accent-pressed);
  color: var(--cp-accent-fg);
}

.primary-button.fui-Button:disabled {
  border-color: var(--cp-disabled-bg);
  background: var(--cp-disabled-bg);
  color: var(--cp-disabled-fg);
}

.secondary-button {
  border-color: var(--cp-border);
  background: var(--cp-surface);
  color: var(--cp-text);
}

.secondary-button:hover,
.icon-button:hover {
  background: var(--cp-surface-hover);
}

.secondary-button:active,
.icon-button:active {
  background: var(--cp-surface-pressed);
}

.secondary-button svg,
.primary-button svg {
  width: 18px;
  height: 18px;
}

.refresh-button.fui-Button {
  width: 36px;
  min-width: 36px;
  height: 36px;
  border: 1px solid var(--cp-input-border);
  background: var(--cp-surface);
  padding: 0;
}

.refresh-button svg {
  width: 18px;
  height: 18px;
}

.account-button {
  justify-content: flex-start;
  gap: 8px;
  min-width: 192px;
  padding: 5px 8px;
  text-align: left;
}

.account-button:hover {
  background: var(--cp-surface-soft);
}

.account-button-icon,
.account-avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--cp-surface-soft);
  color: var(--cp-text);
}

.account-button-icon {
  width: 34px;
  height: 34px;
}

.account-button-icon img,
.account-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.account-copy {
  display: grid;
  min-width: 0;
}

.account-button small {
  color: var(--cp-text-muted);
}

.sidebar {
  position: sticky;
  z-index: 30;
  top: 0;
  display: flex;
  align-self: start;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  border-right: 0;
  box-shadow: inset -1px 0 var(--cp-border);
  background: color-mix(
    in srgb,
    var(--cp-surface) 99%,
    var(--cp-text) 1%
  );
  padding: 8px 0;
  transition:
    width var(--cp-motion-medium) var(--cp-motion-ease),
    box-shadow var(--cp-motion-medium) ease-out,
    transform var(--cp-motion-medium) var(--cp-motion-ease);
}

.sidebar-scroll {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-top: 12px;
}

.sidebar-scroll > nav {
  flex-shrink: 0;
}

.sidebar-account-divider {
  flex-shrink: 0;
  width: 100%;
  margin-top: 12px;
  border-top: 1px solid var(--cp-border);
}

.collapse-button {
  display: grid;
  width: 24px;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 8px;
  padding: 4px;
  transition:
    background-color var(--cp-motion-fast) ease-out,
    color var(--cp-motion-fast) ease-out,
    transform var(--cp-motion-fast) var(--cp-motion-ease);
}

.collapse-button:hover {
  transform: scale(1.04);
}

.collapse-button svg {
  width: 16px;
  height: 16px;
}

.desktop-collapse-button {
  width: 32px;
  min-width: 32px;
  height: 32px;
}

.sidebar-toggle-icons {
  position: relative;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
}

.sidebar-toggle-icons svg {
  position: absolute;
  inset: 0;
  transition:
    opacity var(--cp-motion-fast) ease-out,
    transform var(--cp-motion-fast) var(--cp-motion-ease);
}

.sidebar-toggle-filled {
  opacity: 0;
  transform: scale(0.82);
}

.desktop-collapse-button:hover .sidebar-toggle-regular {
  opacity: 0;
  transform: scale(0.82);
}

.desktop-collapse-button:hover .sidebar-toggle-filled {
  opacity: 1;
  transform: scale(1);
}

.mobile-menu-button,
.mobile-navigation-backdrop {
  display: none;
}

.sidebar-account {
  width: calc(100% - 16px);
  min-width: 0;
  flex: 0 0 auto;
  margin: 12px 8px 0;
  border-top: 0;
  border-radius: 12px;
  padding: 4px;
}

.nav-label {
  display: flex;
  width: calc(100% - 16px);
  min-height: 32px;
  align-items: center;
  margin: 0 8px;
  border-radius: 12px;
  padding: 4px 4px 4px 8px;
  font-size: 12px;
  font-weight: 420;
  letter-spacing: 0;
  line-height: 16px;
  text-transform: none;
}

.fleet-nav-section {
  margin-bottom: 14px;
}

.fleet-selector {
  width: calc(100% - 16px);
  margin: 0 8px;
  border-radius: 12px;
  background: var(--cp-surface);
  padding: 8px;
}

.fleet-selector-control {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.fleet-picker-trigger.fui-Button {
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  border-color: var(--cp-input-border);
  background: var(--cp-surface);
  color: var(--cp-text);
  padding-inline: 12px 8px;
}

.fleet-picker-trigger-copy {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fleet-picker-trigger-chevron {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

.fleet-picker-popover.fui-PopoverSurface {
  width: min(260px, calc(100vw - 32px));
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  background: var(--cp-surface);
  box-shadow: var(--cp-shadow);
  padding: 10px;
}

.fleet-picker-search {
  width: 100%;
  margin-bottom: 8px;
}

.fleet-picker-list {
  display: grid;
  gap: 4px;
  max-height: min(360px, 50vh);
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fleet-picker-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
  border-radius: 10px;
  transition: background-color var(--cp-motion-fast) ease-out;
}

.fleet-picker-row.deletable {
  grid-template-columns: minmax(0, 1fr) 32px 32px;
}

.fleet-picker-row.selected {
  background: var(--cp-surface-hover);
}

.fleet-picker-row:hover {
  background: var(--cp-surface-hover);
}

.fleet-picker-select {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
  padding: 8px;
}

.fleet-picker-select:focus-visible,
.fleet-picker-create:focus-visible,
.fleet-picker-action:focus-visible {
  outline: 2px solid var(--cp-link);
  outline-offset: -2px;
}

.fleet-picker-select:disabled {
  color: var(--cp-disabled-fg);
  cursor: not-allowed;
}

.fleet-picker-check {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
}

.fleet-picker-copy {
  display: grid;
  min-width: 0;
}

.fleet-picker-copy strong,
.fleet-picker-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fleet-picker-copy small {
  color: var(--cp-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.fleet-picker-action.fui-Button {
  width: 32px;
  min-width: 32px;
  height: 32px;
}

.fleet-picker-delete.fui-Button {
  color: var(--cp-danger);
}

.fleet-picker-create.fui-Button {
  width: 100%;
  justify-content: flex-start;
  margin-top: 8px;
  border-top: 1px solid var(--cp-border);
  border-radius: 0 0 8px 8px;
  padding-top: 10px;
}

.fleet-picker-empty {
  margin: 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.fleet-provider-warning {
  overflow: hidden;
  color: var(--cp-text-muted);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fleet-provider-warning {
  display: block;
  margin: 5px 12px 0 36px;
  color: var(--cp-status-warning-text);
}

.provider-source {
  display: grid;
  gap: 3px;
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  background: var(--cp-surface-subtle);
  padding: 10px 12px;
}

.provider-source span,
.provider-source code {
  overflow-wrap: anywhere;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.nav-button,
.project-button {
  display: flex;
  width: calc(100% - 16px);
  align-items: center;
  gap: 8px;
  margin-inline: 8px;
  color: var(--cp-text-muted);
  font-weight: 420;
  text-align: left;
}

.nav-button.fui-Button {
  min-height: 32px;
  height: 32px;
  border: 0;
  border-radius: 12px;
  padding: 4px 4px 4px 8px;
  font-size: 14px;
  line-height: 20px;
  transition:
    background-color 100ms ease-out,
    color 100ms ease-out;
}

.nav-button .fui-Button__icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  margin: 0;
  color: currentColor;
  place-items: center;
  transition: color 100ms ease-out;
}

.nav-button .fui-Button__icon svg {
  width: 16px;
  height: 16px;
  color: inherit;
}

.nav-button.fui-Button,
.project-button.fui-Button,
.account-button.fui-Button {
  justify-content: flex-start;
}

.sidebar .nav-button:hover,
.sidebar .project-button:hover {
  background-color: color-mix(in srgb, var(--cp-text) 4%, transparent);
  color: var(--cp-text);
}

.sidebar .nav-button.selected,
.sidebar .project-button.selected {
  border-color: transparent;
  background-color: color-mix(in srgb, var(--cp-text) 8%, transparent);
  color: var(--cp-text);
}

.sidebar .nav-button.selected {
  font-weight: 625;
}

.sidebar .nav-button:hover .fui-Button__icon,
.sidebar .nav-button.selected .fui-Button__icon {
  color: var(--cp-accent);
}

.sidebar .nav-button.selected:hover,
.sidebar .project-button.selected:hover {
  background-color: color-mix(in srgb, var(--cp-text) 12%, transparent);
}

.sidebar .nav-button:active,
.sidebar .project-button:active,
.sidebar .nav-button.selected:active,
.sidebar .project-button.selected:active {
  background-color: color-mix(in srgb, var(--cp-text) 16%, transparent);
}

.nav-button:focus-visible {
  outline: 2px solid var(--cp-text);
  outline-offset: 2px;
  box-shadow: inset 0 0 0 1px var(--cp-surface);
}

.nav-button.planned {
  margin-top: 2px;
}

.nav-button.planned .nav-meta {
  margin-left: auto;
  color: var(--cp-text-soft);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.projects-nav {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding-bottom: 4px;
  margin-top: 28px;
}

.project-heading {
  display: flex;
  width: 100%;
  align-items: center;
  padding-right: 8px;
}

.project-heading .nav-label {
  width: auto;
  flex: 1;
}

.project-search-toggle.fui-Button,
.project-menu-button.fui-Button {
  display: grid;
  min-width: 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  padding: 4px;
}

.project-search-toggle svg,
.project-menu-button svg {
  width: 16px;
  height: 16px;
}

.project-search {
  width: calc(100% - 16px);
  margin: 4px 8px 8px;
}

.project-search .fui-Input__contentBefore svg {
  width: 16px;
  height: 16px;
}

.project-group-label {
  display: flex;
  width: calc(100% - 16px);
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 8px 4px;
  border-radius: 12px;
  background: transparent;
  padding: 4px 4px 4px 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
  font-weight: 420;
  letter-spacing: 0;
  line-height: 16px;
  text-transform: none;
}

.project-group-label span {
  color: var(--cp-text-soft);
  font-variant-numeric: tabular-nums;
}

.project-button {
  align-items: flex-start;
  margin-bottom: 2px;
  border-radius: 12px;
  padding: 8px 4px 8px 8px;
  transition:
    background-color 100ms ease-out,
    color 100ms ease-out;
}

.project-nav-item {
  position: relative;
  width: calc(100% - 16px);
  margin: 0 8px 2px;
}

.project-nav-item .project-button {
  width: 100%;
  margin: 0;
  padding-right: 34px;
}

.project-menu-button.fui-Button {
  position: absolute;
  top: 6px;
  right: 3px;
  color: var(--cp-text-muted);
  opacity: 0;
  transition:
    background-color 100ms ease-out,
    color 100ms ease-out,
    opacity 100ms ease-out;
}

.project-nav-item:hover .project-menu-button,
.project-nav-item:focus-within .project-menu-button {
  opacity: 1;
}

.project-menu-button:hover {
  background: color-mix(in srgb, var(--cp-text) 8%, transparent);
  color: var(--cp-text);
}

.project-search-empty {
  margin: 8px 16px;
  color: var(--cp-text-soft);
  font-size: 12px;
}

.project-icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
}

.project-icon svg {
  width: 16px;
  height: 16px;
}

.project-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.project-name {
  overflow: hidden;
  color: inherit;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-copy .project-name-active {
  color: var(--cp-success);
}

.project-copy span {
  color: var(--cp-text-soft);
  font-size: 12px;
}

.source-dot,
.live-dot,
.process-marker {
  display: inline-block;
  flex: 0 0 auto;
  border-radius: 50%;
}

.activity-view {
  min-width: 0;
}

.activity-panel {
  max-width: 1120px;
}

.activity-heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.activity-clear-button.fui-Button {
  flex: 0 0 auto;
}

.activity-clear-dialog {
  max-width: 520px;
}

.activity-clear-copy {
  margin-top: 12px;
  color: var(--cp-text-muted);
}

.available {
  background: var(--cp-success);
}

.missing {
  background: var(--cp-border-strong);
}

.sidebar-collapsed .sidebar-brand {
  flex-direction: column;
  padding-right: 0;
  padding-left: 0;
}

.sidebar-collapsed .sidebar-brand .brand-mark {
  display: none;
}

.sidebar-collapsed .desktop-collapse-button {
  margin-inline: auto;
}

.sidebar-collapsed .fleet-selector,
.sidebar-collapsed .fleet-provider-warning {
  display: none;
}

.sidebar-collapsed .fleet-nav-section {
  margin-bottom: 8px;
}

.sidebar-collapsed .brand-copy,
.sidebar-collapsed .nav-label,
.sidebar-collapsed .nav-text,
.sidebar-collapsed .nav-meta,
.sidebar-collapsed .project-copy,
.sidebar-collapsed .project-group-label,
.sidebar-collapsed .account-copy {
  display: none;
}

.sidebar-collapsed .project-heading,
.sidebar-collapsed .project-search,
.sidebar-collapsed .project-search-empty,
.sidebar-collapsed .project-menu-button {
  display: none;
}

.sidebar-collapsed .sidebar-scroll {
  padding-top: 12px;
}

.sidebar-collapsed .projects-nav {
  margin-top: 14px;
  border-top: 1px solid var(--cp-border);
  padding-top: 14px;
}

.sidebar-collapsed .nav-button.fui-Button,
.sidebar-collapsed .project-button.fui-Button,
.sidebar-collapsed .account-button.fui-Button {
  justify-content: center;
}

.sidebar-collapsed .nav-button,
.sidebar-collapsed .project-button,
.sidebar-collapsed .account-button {
  width: 32px;
  min-width: 0;
  margin-inline: 12px;
  padding: 4px;
}

.sidebar-collapsed .project-nav-item {
  width: 32px;
  margin-inline: 12px;
}

.sidebar-collapsed .project-nav-item .project-button {
  margin: 0;
}

.sidebar-collapsed .account-button {
  width: 40px;
  min-width: 40px;
  height: 40px;
  margin-inline: 8px;
}

.sidebar-collapsed .account-button-icon {
  width: 32px;
  height: 32px;
}

.sidebar-collapsed .project-icon {
  width: 20px;
  flex-basis: 20px;
}

.main-content {
  min-width: 0;
  padding: 28px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.page-heading h2 {
  margin-top: 4px;
  font-size: clamp(24px, 3vw, 34px);
}

.page-heading p:last-child {
  max-width: 760px;
  margin-top: 6px;
  color: var(--cp-text-muted);
}

.overview-heading {
  align-items: flex-start;
}

.overview-heading-copy {
  min-width: 0;
}

.overview-heading-copy h2 {
  overflow-wrap: anywhere;
}

.overview-subtitle {
  display: grid;
}

.overview-subtitle > span {
  grid-area: 1 / 1;
  opacity: 1;
  transition: opacity var(--cp-motion-medium) var(--cp-motion-ease);
}

.overview-subtitle > span[aria-hidden="true"] {
  opacity: 0;
  pointer-events: none;
  user-select: none;
}

.overview-heading-tools {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.live-state {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.live-dot {
  width: 8px;
  height: 8px;
  background: var(--cp-success);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--cp-border);
  border-radius: 16px;
  background: var(--cp-border);
}

.view-enter {
  animation: view-rise 240ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.auth-gate-card,
.dashboard-skeleton {
  animation: view-rise 260ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.settings-panel-enter {
  animation: panel-enter 180ms ease-out both;
}

.view-transitions-supported .view-enter,
.view-transitions-supported .auth-gate-card,
.view-transitions-supported .dashboard-skeleton,
.view-transitions-supported .settings-panel-enter {
  animation: none;
}

.dashboard-skeleton {
  display: grid;
  gap: 28px;
}

.skeleton-heading,
.skeleton-section-heading,
.skeleton-copy {
  display: grid;
  gap: 8px;
}

.skeleton-heading {
  max-width: 620px;
}

.skeleton-section-heading {
  max-width: 320px;
}

.skeleton-card {
  pointer-events: none;
}

.skeleton-block,
.skeleton-line {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 0.625rem;
  background: var(--cp-surface-soft);
}

.skeleton-block::after,
.skeleton-line::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--cp-surface-soft),
    var(--cp-sheen),
    var(--cp-surface-soft)
  );
  content: "";
  transform: translateX(-100%);
  animation: skeleton-shimmer 1.35s ease-in-out infinite;
}

.skeleton-line {
  height: 12px;
}

.skeleton-short {
  width: 88px;
}

.skeleton-title {
  width: min(280px, 70%);
  height: 28px;
}

.skeleton-medium {
  width: min(190px, 72%);
}

.skeleton-wide {
  width: 100%;
}

.skeleton-value {
  width: 96px;
  height: 30px;
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  margin-top: 16px;
}

.skeleton-copy {
  min-width: 0;
  margin-top: 18px;
}

.skeleton-station {
  min-height: 230px;
  justify-content: flex-start;
}

.skeleton-station.skeleton-tall {
  min-height: 280px;
}

@keyframes skeleton-shimmer {
  to {
    transform: translateX(100%);
  }
}

@keyframes view-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}

::view-transition-group(dashboard-content),
::view-transition-image-pair(dashboard-content) {
  background: var(--cp-bg);
}

::view-transition-old(dashboard-content) {
  animation: content-exit 100ms ease-in both;
  mix-blend-mode: normal;
}

::view-transition-new(dashboard-content) {
  animation: content-enter 160ms 100ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  mix-blend-mode: normal;
}

html.station-transition-active .content-shell {
  view-transition-name: none;
}

html.station-transition-active::view-transition-group(*) {
  animation-duration: var(--cp-motion-slow);
  animation-timing-function: var(--cp-motion-ease);
}

html.station-transition-active::view-transition-old(*) {
  animation: station-filter-exit var(--cp-motion-fast) ease-in both;
  mix-blend-mode: normal;
}

html.station-transition-active::view-transition-new(*) {
  animation: station-filter-enter var(--cp-motion-medium)
    var(--cp-motion-ease) both;
  mix-blend-mode: normal;
}

html.station-transition-active::view-transition-old(root),
html.station-transition-active::view-transition-new(root) {
  animation: none;
}

@keyframes content-exit {
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes station-filter-exit {
  to {
    opacity: 0;
    transform: scale(0.985);
  }
}

@keyframes station-filter-enter {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
}

@keyframes content-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.handoff-view {
  min-width: 0;
}

@media (min-width: 1181px) {
  .main-content-handoffs {
    display: flex;
    height: 100vh;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 0;
  }

  .main-content-handoffs .handoff-view {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .main-content-handoffs .handoff-board {
    min-height: 0;
    flex: 1;
    padding-bottom: 0;
  }

  .main-content-handoffs .handoff-column {
    display: flex;
    min-height: 0;
    flex-direction: column;
  }

  .main-content-handoffs .handoff-column-body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
}

.handoff-note {
  margin-bottom: 16px;
  color: var(--cp-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.handoff-board {
  display: grid;
  grid-auto-columns: 260px;
  grid-auto-flow: column;
  gap: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--cp-border);
  border-radius: 16px;
  background: var(--cp-bg-elevated);
  padding: 0 0 16px;
  overscroll-behavior-x: contain;
  scroll-behavior: smooth;
}

.handoff-column {
  min-height: 540px;
  overflow: hidden;
  border-right: 1px solid var(--cp-border);
  border-radius: 0;
  background: var(--cp-bg-elevated);
  transition:
    background-color 120ms ease-out,
    box-shadow 120ms ease-out;
}

.handoff-column[data-drop-target="true"] {
  background: color-mix(in srgb, var(--cp-accent) 10%, var(--cp-bg-elevated));
  box-shadow: inset 0 0 0 3px var(--cp-accent);
}

.handoff-column:last-child {
  border-right: 0;
}

.handoff-column-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--cp-border);
  background: var(--cp-surface);
  padding: 10px;
}

.handoff-column-header > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.handoff-column-header strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.handoff-column-header small {
  color: var(--cp-text-muted);
}

.handoff-column-body {
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: 8px;
  min-height: 480px;
  padding: 8px;
}

.handoff-card {
  gap: 10px;
  padding: 12px;
}

.handoff-column-body > .handoff-card {
  height: auto;
  min-height: max-content;
  max-height: none;
}

.handoff-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.handoff-navigation {
  display: flex;
  gap: 4px;
}

.handoff-navigation .fui-Button {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
}

.dashboard-refresh-status {
  flex-shrink: 0;
  color: var(--cp-text-muted);
}

.handoff-card[draggable="true"] {
  cursor: grab;
}

.handoff-card[data-dragging="true"] {
  cursor: grabbing;
  opacity: 0.55;
}

.handoff-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.handoff-card-title {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 6px;
}

.handoff-card-title > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  margin-top: 2px;
  color: var(--cp-text-muted);
}

.handoff-card-title > strong {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.handoff-card > p {
  overflow-wrap: anywhere;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.handoff-trail {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--cp-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.handoff-trail > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.handoff-trail .current {
  color: var(--cp-text);
  font-weight: 500;
}

.handoff-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--cp-border);
  padding-top: 8px;
}

.handoff-card-actions .searchable-select {
  min-width: 0;
  flex: 1;
}

.handoff-card-footer {
  color: var(--cp-text-muted);
  font-size: 11px;
  text-align: right;
}

.handoff-pr-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
}

.handoff-empty {
  padding: 24px 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
  text-align: center;
}

.metric-card,
.fui-Card::after {
  border-radius: inherit;
}

.station-card {
  background: var(--cp-surface);
}

.metric-card {
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: flex-start;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.metrics-grid > .metric-card {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: var(--cp-surface);
}

.metric-card > .eyebrow {
  font-weight: 500;
  letter-spacing: 0.12em;
}

.metrics-grid .skeleton-copy {
  margin-top: 0;
}

.metric-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
  margin-top: 0;
}

.metric-value {
  overflow: visible;
  margin-top: 0;
  font-size: 34px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.metric-value > span {
  display: inline-block;
}

.metric-value.is-counting > span {
  animation:
    metric-value-count-in 900ms cubic-bezier(0.22, 0.8, 0.32, 1)
    var(--metric-count-delay, 0ms) both;
}

@keyframes metric-value-count-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.metric-detail-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-top: auto;
}

.metric-detail {
  overflow-wrap: anywhere;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.metric-info-button.fui-Button {
  width: 20px;
  min-width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: var(--cp-text-muted);
  padding: 0;
}

.metric-info-button.fui-Button:hover {
  background: var(--cp-surface-soft);
  color: var(--cp-text);
}

.section-block,
.two-column {
  margin-top: 28px;
}

.section-heading {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 12px;
}

.section-heading h2,
.panel-heading h2 {
  margin-top: 3px;
}

.section-note {
  max-width: 480px;
  color: var(--cp-text-muted);
  font-size: 12px;
  text-align: right;
}

.model-section-actions {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.model-heading-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-smoke-button.fui-Button {
  min-width: 32px;
  width: 32px;
  height: 32px;
  padding: 4px;
}

.model-smoke-button.is-running svg,
.smoke-status-running svg {
  animation: status-pulse 1.2s ease-in-out infinite;
}

.model-status-trigger {
  display: inline-flex;
}

.model-action-message {
  margin-bottom: 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
  text-align: right;
}

.model-actions-cell {
  width: 44px;
  padding-right: 8px;
  text-align: right;
}

.smoke-suite-project {
  display: grid;
  gap: 5px;
  color: var(--cp-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.smoke-suite-list {
  display: grid;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
}

.smoke-suite-row {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--cp-border);
  padding: 9px 12px;
}

.smoke-suite-row:last-child {
  border-bottom: 0;
}

.smoke-suite-row > span:first-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.smoke-suite-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smoke-suite-row small {
  color: var(--cp-text-muted);
}

.station-grid {
  --station-grid-columns: 5;

  display: grid;
  max-width: 1648px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}

.station-grid-masonry {
  grid-auto-rows: 1px;
  column-gap: 12px;
  row-gap: 0;
}

.station-grid-item {
  min-width: 0;
  padding-bottom: 12px;
}

.station-grid-item > .station-card {
  height: auto;
}

.station-filter-bar {
  display: grid;
  grid-template-columns:
    minmax(160px, 2fr)
    repeat(2, minmax(112px, 1fr))
    minmax(128px, 1fr)
    32px
    32px;
  min-width: 0;
  align-items: center;
  gap: 8px;
  width: min(100%, 920px);
  justify-self: end;
  overflow-x: auto;
  padding: 3px;
}

.station-heading-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 24px;
}

.station-search {
  width: 100%;
  min-width: 0;
}

.station-sort-direction {
  width: 32px;
  min-width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
}

.station-filter-reset {
  width: 32px;
  min-width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
}

.station-filter-bar .fui-Combobox,
.station-filter-bar select {
  width: 100%;
  min-width: 0;
}

.station-filter-bar .fui-Input {
  height: 32px;
  min-height: 32px;
  border-radius: 8px;
}

.station-filter-bar .fui-Input__input {
  min-height: 30px;
  font-size: 12px;
}

.station-filter-bar .fui-Combobox {
  height: 32px;
  min-height: 32px;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  padding: 0;
  font-size: 12px;
}

.station-filter-bar .fui-Combobox__input {
  min-height: 30px;
  font-size: 12px;
}

.station-filter-bar .fui-Combobox::after {
  display: none !important;
}

.station-filter-summary {
  margin-bottom: 12px;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.station-filter-empty {
  display: grid;
  width: 100%;
  min-height: 260px;
  grid-column: 1 / -1;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--cp-text-muted);
  text-align: center;
}

.station-filter-empty > svg {
  width: 28px;
  height: 28px;
}

.pipeline-view {
  display: flex;
  min-width: 0;
  min-height: calc(100vh - 56px);
  flex-direction: column;
  overflow: visible;
}

.main-content-pipeline {
  --pipeline-bg: var(--cp-surface);
  --pipeline-card: color-mix(in srgb, var(--cp-surface) 94%, var(--cp-surface-soft));
  --pipeline-card-strong: color-mix(in srgb, var(--cp-surface) 88%, var(--cp-warning));
  --pipeline-text: var(--cp-text);
  --pipeline-muted: color-mix(in srgb, var(--cp-text-muted) 86%, var(--cp-text));
  --pipeline-dot: color-mix(in srgb, var(--cp-border-strong) 68%, var(--cp-border));
  --pipeline-edge: color-mix(in srgb, var(--cp-link) 76%, var(--cp-text));
  --pipeline-edge-muted: color-mix(in srgb, var(--cp-text-muted) 68%, var(--cp-link));
  --pipeline-card-border: color-mix(in srgb, var(--cp-border) 74%, var(--cp-border-strong));
  --pipeline-card-shadow: color-mix(in srgb, var(--cp-text) 12%, transparent);
  --pipeline-card-shadow-strong: color-mix(in srgb, var(--cp-text) 18%, transparent);
  position: relative;
  min-height: 100vh;
  overflow: visible;
  isolation: isolate;
  background: var(--pipeline-bg);
  color: var(--pipeline-text);
}

html[data-theme="dark"] .main-content-pipeline {
  --pipeline-bg: var(--cp-surface);
  --pipeline-card: color-mix(in srgb, var(--cp-surface-soft) 88%, var(--cp-surface));
  --pipeline-card-strong: color-mix(in srgb, var(--cp-surface-soft) 84%, var(--cp-warning));
  --pipeline-text: var(--cp-text);
  --pipeline-muted: color-mix(in srgb, var(--cp-text-muted) 74%, var(--cp-text));
  --pipeline-dot: color-mix(in srgb, var(--cp-border-strong) 78%, var(--cp-border));
  --pipeline-edge: color-mix(in srgb, var(--cp-link) 82%, var(--cp-text));
  --pipeline-edge-muted: color-mix(in srgb, var(--cp-text-muted) 72%, var(--cp-link));
  --pipeline-card-border: color-mix(in srgb, var(--cp-border) 68%, var(--cp-border-strong));
  --pipeline-card-shadow: color-mix(in srgb, var(--cp-bg) 72%, transparent);
  --pipeline-card-shadow-strong: color-mix(in srgb, var(--cp-bg) 86%, transparent);
}

.pipeline-page-grid {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pipeline-page-grid circle {
  fill: var(--pipeline-dot);
  opacity: 0.3;
}

.main-content-pipeline > :not(.pipeline-page-grid) {
  position: relative;
  z-index: 1;
}

.pipeline-frame {
  position: relative;
  display: flex;
  container-name: pipeline;
  container-type: inline-size;
  width: 100%;
  max-width: 1280px;
  min-height: 590px;
  flex: 1;
  flex-direction: column;
  overflow: visible;
  margin-inline: auto;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--pipeline-text);
  box-shadow: none;
  padding: 0 32px 48px;
}

.pipeline-toolbar {
  position: relative;
  z-index: 4;
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 12px 20px;
  margin-inline: -32px;
  padding: 12px 20px;
}

.pipeline-toolbar-title,
.pipeline-workflow-label,
.pipeline-key,
.pipeline-key span,
.pipeline-node-role {
  display: flex;
  align-items: center;
}

.pipeline-toolbar-title {
  flex: 0 0 auto;
  gap: 8px;
}

.pipeline-toolbar-title strong {
  font-size: 13px;
}

.pipeline-prototype-label {
  border: 1px solid color-mix(in srgb, var(--cp-link) 64%, var(--pipeline-muted));
  border-radius: 999px;
  padding: 2px 7px;
  color: var(--pipeline-muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 14px;
  text-transform: uppercase;
}

.pipeline-workflow-label {
  flex: 0 0 auto;
  gap: 6px;
  color: var(--pipeline-muted);
  font-size: 11px;
}

.pipeline-workflow-label svg {
  width: 15px;
  height: 15px;
  color: var(--cp-link);
}

.pipeline-key {
  min-width: 0;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px 14px;
  border: 1px solid var(--pipeline-card-border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--pipeline-card) 92%, transparent);
  padding: 6px 10px;
  color: var(--pipeline-muted);
  font-size: 10px;
}

.pipeline-key span {
  gap: 6px;
  white-space: nowrap;
}

.pipeline-key i {
  display: inline-block;
  width: 22px;
  height: 0;
  border-top: 2px solid var(--pipeline-edge);
}

.pipeline-key .pipeline-key-conditional {
  border-top-color: var(--pipeline-edge-muted);
  border-top-style: dashed;
}

.pipeline-zoom-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--pipeline-card-border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--pipeline-card) 88%, transparent);
  padding: 2px;
}

.pipeline-canvas-footer {
  position: absolute;
  z-index: 5;
  right: 20px;
  bottom: 12px;
  left: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  pointer-events: none;
}

.pipeline-canvas-footer > * {
  pointer-events: auto;
}

.pipeline-canvas-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.pipeline-zoom-button.fui-Button {
  width: 24px;
  min-width: 24px;
  height: 24px;
  color: var(--pipeline-muted);
  padding: 0;
}

.pipeline-zoom-button.fui-Button:hover {
  background: color-mix(in srgb, var(--pipeline-muted) 12%, transparent);
  color: var(--pipeline-text);
}

.pipeline-zoom-readout {
  min-width: 42px;
  color: var(--pipeline-text);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
}

.pipeline-reset-button.fui-Button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  flex: 0 0 28px;
  color: var(--pipeline-muted);
  padding: 0;
}

.pipeline-reset-button.fui-Button:hover {
  background: color-mix(in srgb, var(--pipeline-muted) 12%, transparent);
  color: var(--pipeline-text);
}

.pipeline-layout {
  position: relative;
  width: 100%;
  min-height: 510px;
  height: auto;
  flex: 1;
  overflow: visible;
}

.pipeline-world {
  position: absolute;
  inset: 0;
  width: 100%;
  height: auto;
  transform-origin: center center;
  transition: transform 280ms cubic-bezier(0.34, 1.18, 0.64, 1);
  will-change: transform;
}

.pipeline-layout-compact,
.pipeline-mobile-workflow {
  display: none;
}

.pipeline-connectors {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pipeline-connectors {
  overflow: visible;
}

.pipeline-forward-paths path,
.pipeline-conditional-paths path {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.pipeline-forward-paths path {
  stroke: var(--pipeline-edge);
}

.pipeline-conditional-paths path {
  stroke: var(--pipeline-edge-muted);
  stroke-dasharray: 6 7;
}

.pipeline-arrow-fill {
  fill: var(--pipeline-edge);
}

.pipeline-phases text,
.pipeline-connector-labels text {
  font-family: var(--cp-font-family);
  paint-order: stroke;
  stroke: var(--pipeline-bg);
  stroke-width: 5px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.pipeline-phases text {
  fill: var(--pipeline-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.pipeline-connector-labels text {
  fill: var(--pipeline-muted);
  font-size: 9px;
  font-weight: 500;
}

.pipeline-node-card {
  --pipeline-rail: var(--cp-link);
  --pipeline-rail-width: 4px;
  position: absolute;
  z-index: 2;
  display: flex;
  width: 12.5%;
  height: 96px;
  min-width: 0;
  flex-direction: column;
  overflow: visible;
  border: 1px solid var(--pipeline-card-border);
  border-radius: 14px;
  background: var(--pipeline-card);
  box-shadow: 0 6px 18px var(--pipeline-card-shadow);
  color: var(--pipeline-text);
  padding: 9px 9px 8px 24px;
}

.pipeline-node-card::before {
  position: absolute;
  z-index: 0;
  top: 8px;
  bottom: 8px;
  left: 7px;
  width: var(--pipeline-rail-width);
  border-radius: 999px;
  background: var(--pipeline-rail);
  content: "";
}

.pipeline-node-card[data-category="design"] {
  --pipeline-rail: var(--cp-link);
}

.pipeline-node-card[data-category="check"] {
  --pipeline-rail: var(--cp-accent);
}

.pipeline-node-card[data-category="writer"] {
  --pipeline-rail: color-mix(in srgb, var(--cp-warning) 72%, var(--cp-accent));
  --pipeline-rail-width: 6px;
  border-color: color-mix(in srgb, var(--pipeline-rail) 42%, var(--pipeline-muted));
  background: var(--pipeline-card-strong);
}

.pipeline-node-card[data-category="delivery"] {
  --pipeline-rail: color-mix(in srgb, var(--cp-link) 68%, var(--cp-accent));
}

.pipeline-node-card[data-category="operation"] {
  --pipeline-rail: color-mix(in srgb, var(--cp-link) 55%, var(--cp-success));
}

.pipeline-node-card[data-category="outcome"] {
  --pipeline-rail: color-mix(in srgb, var(--cp-accent) 48%, var(--cp-link));
  border-color: color-mix(in srgb, var(--pipeline-rail) 30%, var(--pipeline-muted));
  background: color-mix(in srgb, var(--pipeline-card) 88%, var(--cp-link));
}

.pipeline-node-card[data-health="down"] {
  --pipeline-rail: var(--cp-danger);
  border-color: color-mix(in srgb, var(--cp-danger) 46%, var(--pipeline-card-border));
  background: color-mix(in srgb, var(--cp-danger) 7%, var(--pipeline-card));
}

.pipeline-node-card[data-dragging="true"] {
  z-index: 5;
  border-color: color-mix(in srgb, var(--cp-link) 72%, var(--pipeline-text));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--cp-link) 42%, transparent),
    0 12px 28px var(--pipeline-card-shadow-strong);
}

.pipeline-node-role {
  min-width: 0;
  gap: 5px;
  padding-right: 22px;
  color: var(--pipeline-muted);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.055em;
  line-height: 13px;
  text-transform: uppercase;
  white-space: nowrap;
}

.pipeline-node-role svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: var(--pipeline-rail);
}

.pipeline-node-role > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.pipeline-drag-handle.fui-Button {
  position: absolute;
  z-index: 4;
  top: 5px;
  right: 5px;
  width: 22px;
  min-width: 22px;
  height: 22px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--pipeline-muted) 8%, transparent);
  color: var(--pipeline-muted);
  cursor: grab;
  padding: 0;
  touch-action: none;
  user-select: none;
}

.pipeline-drag-handle.fui-Button:hover {
  background: color-mix(in srgb, var(--pipeline-muted) 16%, transparent);
  color: var(--pipeline-text);
}

.pipeline-drag-handle.fui-Button:active,
.pipeline-node-card[data-dragging="true"] .pipeline-drag-handle.fui-Button {
  cursor: grabbing;
}

.pipeline-drag-handle.fui-Button:focus-visible,
.pipeline-zoom-button.fui-Button:focus-visible,
.pipeline-reset-button.fui-Button:focus-visible {
  outline: 3px solid var(--cp-accent);
  outline-offset: 2px;
}

.pipeline-node-card h3 {
  overflow: hidden;
  margin-top: 2px;
  color: var(--pipeline-text);
  font-size: 13px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline-node-model,
.pipeline-outcome-detail {
  overflow: hidden;
  color: var(--pipeline-muted);
  font-size: 9.5px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline-node-model {
  margin-top: auto;
}

.pipeline-port {
  position: absolute;
  z-index: 3;
  width: 8px;
  height: 8px;
  border: 2px solid var(--pipeline-rail);
  border-radius: 50%;
  background: var(--pipeline-bg);
  box-shadow: 0 0 0 2px var(--pipeline-bg);
}

.pipeline-port-input {
  top: 44px;
  left: -5px;
}

.pipeline-port-output {
  top: 44px;
  right: -5px;
}

.pipeline-port-top {
  top: -5px;
  left: calc(50% - 4px);
}

.pipeline-port-bottom {
  bottom: -5px;
  left: calc(50% - 4px);
}

.pipeline-port-branch-output {
  left: calc(50% - 4px);
}

.pipeline-port-monitoring-output {
  left: calc(32% - 4px);
}

.pipeline-port-integration-output {
  left: calc(68% - 4px);
}

.pipeline-feedback-panel {
  display: grid;
  gap: 14px;
  margin: 0 0 44px;
  border: 1px solid color-mix(in srgb, var(--cp-danger) 16%, var(--pipeline-card-border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--cp-danger) 4%, var(--pipeline-card));
  padding: 16px;
}

.pipeline-feedback-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pipeline-feedback-heading-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--cp-danger) 11%, transparent);
  color: var(--cp-danger);
}

.pipeline-feedback-heading-icon svg {
  width: 18px;
  height: 18px;
}

.pipeline-feedback-heading h3 {
  color: var(--pipeline-text);
  font-size: 13px;
  line-height: 18px;
}

.pipeline-feedback-heading p {
  margin-top: 2px;
  color: var(--pipeline-muted);
  font-size: 10px;
  line-height: 15px;
}

.pipeline-feedback-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.pipeline-feedback-route {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cp-danger) 26%, var(--pipeline-card-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--cp-danger) 3%, var(--pipeline-card));
  padding: 11px 12px;
}

.pipeline-feedback-reason {
  width: fit-content;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cp-danger) 9%, transparent);
  color: color-mix(in srgb, var(--cp-danger) 82%, var(--pipeline-text));
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 600;
  line-height: 14px;
}

.pipeline-feedback-flow {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.pipeline-feedback-source,
.pipeline-feedback-target {
  overflow: hidden;
  color: var(--pipeline-text);
  font-size: 10px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline-feedback-target {
  text-align: right;
}

.pipeline-feedback-arrow {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cp-danger) 9%, transparent);
  color: var(--cp-danger);
}

.pipeline-feedback-arrow svg {
  width: 14px;
  height: 14px;
}

.pipeline-outcome-detail {
  margin-top: 3px;
  white-space: normal;
}

.pipeline-layout-compact {
  height: 540px;
}

.pipeline-layout-compact .pipeline-node-card {
  width: 22%;
}

.pipeline-mobile-workflow {
  position: relative;
  z-index: 2;
  gap: 28px;
  padding-top: 20px;
}

.pipeline-mobile-workflow > section > h3,
.pipeline-mobile-returns > h3 {
  color: var(--pipeline-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pipeline-mobile-primary {
  position: relative;
  display: grid;
  gap: 16px;
  margin: 14px 0 0;
  padding: 0 0 0 28px;
  list-style: none;
}

.pipeline-mobile-primary::before {
  position: absolute;
  top: 44px;
  bottom: 44px;
  left: 8px;
  width: 2px;
  border-radius: 999px;
  background: var(--pipeline-edge);
  content: "";
}

.pipeline-mobile-step {
  position: relative;
}

.pipeline-mobile-step::before {
  position: absolute;
  top: 47px;
  left: -20px;
  width: 20px;
  border-top: 2px solid var(--pipeline-edge);
  content: "";
}

.pipeline-mobile-workflow .pipeline-node-card {
  position: relative;
  top: auto !important;
  left: auto !important;
  width: 100%;
  height: auto;
  min-height: 96px;
}

.pipeline-mobile-workflow .pipeline-port {
  display: none;
}

.pipeline-mobile-optional {
  display: grid;
  gap: 8px;
  margin: 14px 0 0 20px;
  border-left: 2px dashed var(--pipeline-edge-muted);
  padding-left: 18px;
}

.pipeline-mobile-optional .pipeline-node-card {
  min-height: 96px;
}

.pipeline-mobile-optional p {
  color: var(--pipeline-muted);
  font-size: 10px;
}

.pipeline-mobile-branch-label,
.pipeline-mobile-relation-label {
  color: var(--pipeline-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.pipeline-mobile-operations {
  display: grid;
  gap: 8px;
  border-top: 1px solid color-mix(in srgb, var(--pipeline-muted) 22%, transparent);
  padding-top: 20px;
}

.pipeline-mobile-operations > p {
  color: var(--pipeline-muted);
  font-size: 11px;
}

.pipeline-mobile-operation-list {
  display: grid;
  gap: 16px;
  margin-top: 8px;
}

.pipeline-mobile-operation {
  display: grid;
  gap: 6px;
}

.pipeline-mobile-returns {
  display: grid;
  gap: 8px;
  border-top: 1px solid color-mix(in srgb, var(--cp-danger) 38%, var(--pipeline-muted));
  padding-top: 20px;
}

.pipeline-mobile-return-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(92px, auto);
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--cp-danger) 8%, var(--pipeline-card));
  color: var(--pipeline-muted);
  padding: 8px 10px;
  font-size: 11px;
}

.pipeline-mobile-return-row > span:nth-child(2) {
  color: var(--cp-danger);
}

.pipeline-mobile-return-row strong {
  color: var(--pipeline-text);
}

@media (min-width: 841px) and (max-width: 1179px) {
  .pipeline-layout-wide {
    display: none;
  }

  .pipeline-layout-compact {
    display: block;
  }

  .pipeline-feedback-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container pipeline (max-width: 700px) {
  .pipeline-layout-compact .pipeline-node-card {
    padding-right: 6px;
    padding-left: 22px;
  }

  .pipeline-layout-compact .pipeline-node-role {
    gap: 3px;
    font-size: 7.5px;
    letter-spacing: 0.025em;
  }

  .pipeline-layout-compact .pipeline-node-role svg {
    width: 13px;
    height: 13px;
    flex-basis: 13px;
  }

  .pipeline-layout-compact .pipeline-node-card h3 {
    font-size: 11px;
  }

  .pipeline-layout-compact .pipeline-node-model,
  .pipeline-layout-compact .pipeline-outcome-detail {
    font-size: 8px;
  }
}

.station-card {
  display: flex;
  width: 100%;
  max-width: none;
  min-width: 0;
  flex-direction: column;
  border-radius: 16px;
  margin-bottom: 0;
  padding: 20px;
}

.station-card-header {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: flex-start;
  column-gap: 10px;
  row-gap: 8px;
}

.station-avatar {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 0.625rem;
  background: var(--cp-surface-soft);
  color: var(--cp-text);
  font-size: 17px;
  font-weight: 600;
}

.station-heading {
  min-width: 0;
}

.station-subtitle {
  overflow-wrap: anywhere;
}

.station-model-name {
  color: var(--cp-text);
}

.station-status-text {
  color: var(--cp-text-muted);
}

.station-status-text.status-healthy,
.station-status-text.status-completed {
  color: var(--cp-success);
}

.station-status-text.status-down,
.station-status-text.status-failed,
.station-status-text.status-cancelled {
  color: var(--cp-danger);
}

.station-status-text.status-warning,
.station-status-text.status-stale,
.station-status-text.status-stalled {
  color: var(--cp-warning);
}

.station-status-text.status-running {
  color: var(--cp-link);
}

.station-card-menu-button.fui-Button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  grid-column: 3;
  grid-row: 1;
  margin-top: -4px;
  padding: 0;
}

.station-heading p,
.station-purpose {
  color: var(--cp-text-muted);
  font-size: 14px;
  line-height: 20px;
}

.station-purpose {
  min-height: 52px;
  margin-top: 12px;
  font-weight: 300;
}

.station-role {
  display: block;
  margin-bottom: 4px;
  color: var(--cp-text);
  font-weight: 600;
}

.status-badge {
  display: inline-flex;
  width: fit-content;
  flex: 0 0 auto;
  align-items: center;
  white-space: nowrap;
}

.status-badge-minimal {
  border: 0;
  background: transparent;
  padding-inline: 0;
}

.station-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0 0;
}

.station-stats div {
  min-width: 0;
  border-top: 1px solid var(--cp-border);
  padding-top: 8px;
}

.station-stats dt {
  color: var(--cp-text-soft);
  font-size: 12px;
  line-height: 16px;
}

.station-stats dd {
  overflow: hidden;
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.station-credit-value {
  cursor: help;
  text-decoration: underline dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.station-credit-tooltip {
  visibility: visible !important;
}

.station-credit-value:focus-visible {
  border-radius: 4px;
  outline: 3px solid var(--cp-link);
  outline-offset: 2px;
}

.two-column {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  gap: 12px;
}

.panel {
  overflow: hidden;
  border-radius: 16px;
  gap: 0;
  padding: 0;
}

.panel-heading {
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--cp-border);
}

.panel-heading > svg {
  color: var(--cp-text-muted);
}

.process-list {
  display: grid;
}

.process-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cp-border);
}

.process-row:last-child {
  border-bottom: 0;
}

.process-marker {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  background: var(--cp-text);
}

.process-main {
  min-width: 0;
}

.process-title-line {
  align-items: flex-start;
  gap: 8px;
}

.process-title-line strong {
  min-width: 0;
  flex: 1;
}

.process-main p,
.process-main span,
.process-time {
  color: var(--cp-text-muted);
  font-size: 12px;
}

.process-main p {
  margin-top: 3px;
}

.process-main span {
  display: block;
  margin-top: 2px;
}

.process-time {
  display: grid;
  align-content: start;
  justify-items: end;
  gap: 8px;
  white-space: nowrap;
}

.process-time a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  text-decoration: none;
}

.empty-state {
  display: grid;
  min-height: 190px;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--cp-text-muted);
  text-align: center;
}

.empty-state.compact {
  min-height: 88px;
}

.empty-state svg {
  width: 28px;
  height: 28px;
}

.smoke-summary {
  padding: 16px;
  border-bottom: 1px solid var(--cp-border);
}

.smoke-summary > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.smoke-summary strong {
  font-size: 26px;
}

.smoke-summary span {
  color: var(--cp-text-muted);
  font-size: 12px;
}

.smoke-bar {
  height: 8px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--cp-surface-soft);
}

.smoke-bar span {
  display: block;
  height: 100%;
  background: var(--cp-success);
}

.smoke-list {
  max-height: 320px;
  overflow-y: auto;
}

.smoke-row {
  display: grid;
  grid-template-columns: auto minmax(90px, 0.6fr) minmax(130px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-bottom: 1px solid var(--cp-border);
}

.smoke-row:last-child {
  border-bottom: 0;
}

.smoke-row span,
.smoke-row small {
  overflow: hidden;
  color: var(--cp-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-wrap {
  overflow-x: auto;
  border-radius: 16px;
  background: var(--cp-surface);
  gap: 0;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--cp-border);
  text-align: left;
  vertical-align: middle;
}

thead th {
  background: var(--cp-surface-soft);
  color: var(--cp-text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

tbody th {
  font-size: 13px;
  font-weight: 600;
}

tbody td {
  color: var(--cp-text-muted);
  font-size: 12px;
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

.data-footer {
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 28px;
  padding: 14px 0;
  border-top: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
  font-size: 11px;
}

.data-footer span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.data-footer span:last-child {
  margin-left: auto;
}

.source-dot {
  width: 7px;
  height: 7px;
}

.dialog-backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  background: var(--cp-overlay);
  padding: 24px;
}

.dialog {
  width: min(620px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  border-radius: 16px;
  background: var(--cp-panel-strong);
  box-shadow: ${tokens.shadow16};
  padding: 20px;
}

.dialog-wide {
  width: min(920px, 100%);
}

.settings-dialog {
  width: min(1040px, calc(100vw - 48px));
  max-width: 1040px;
}

.settings-view {
  min-width: 0;
}

.settings-page-heading {
  margin-bottom: 20px;
}

.settings-surface {
  min-height: 620px;
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 24px;
}

.command-dialog {
  width: min(760px, calc(100vw - 48px));
  max-width: 760px;
}

.command-content {
  display: grid;
  gap: 16px;
  margin-inline: -5px;
  padding: 8px 5px 5px;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.command-grid label,
.control-field,
.command-prompt {
  display: grid;
  gap: 5px;
  color: var(--cp-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.command-prompt textarea {
  min-height: 140px;
}

.command-output {
  max-height: 260px;
  overflow: auto;
  margin: 0;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-bg-elevated);
  padding: 12px;
  color: var(--cp-text);
  font-family: Consolas, "Courier New", Courier, monospace;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.command-content .notice {
  display: grid;
  gap: 3px;
}

.command-content .notice span {
  font-size: 12px;
}

.settings-content {
  padding-top: 12px;
}

.settings-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 28px;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-right: 1px solid var(--cp-border);
  padding-right: 16px;
}

.settings-nav-button.fui-Button {
  justify-content: flex-start;
}

.settings-nav-button.selected {
  background: var(--cp-surface-soft);
  color: var(--cp-text);
  font-weight: 500;
}

.settings-panel,
.settings-agents {
  display: grid;
  min-width: 0;
  gap: 28px;
}

.settings-intro {
  display: grid;
  gap: 6px;
}

.settings-intro p:last-child,
.settings-section-heading p {
  color: var(--cp-text-muted);
}

.settings-section {
  display: grid;
  gap: 16px;
  border-top: 1px solid var(--cp-border);
  padding-top: 20px;
}

.settings-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.settings-section-heading > div {
  display: grid;
  gap: 4px;
}

.project-settings-list {
  display: grid;
  gap: 8px;
}

.project-settings-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
}

.project-settings-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-surface-soft);
  color: var(--cp-text-muted);
}

.project-settings-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.project-settings-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-settings-copy small,
.project-settings-empty {
  color: var(--cp-text-muted);
}

.project-settings-empty {
  margin: 0;
}

.theme-mode-fieldset {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.theme-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.theme-mode-option {
  position: relative;
  cursor: pointer;
}

.theme-mode-option > input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.theme-mode-card {
  display: grid;
  min-height: 112px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.theme-mode-card.selected {
  outline: 2px solid var(--cp-text);
  outline-offset: 2px;
}

.theme-mode-option > input:focus-visible + .theme-mode-card {
  outline: 3px solid var(--cp-link);
  outline-offset: 3px;
}

.theme-mode-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-surface-soft);
}

.theme-mode-copy {
  display: grid;
  gap: 3px;
}

.theme-mode-copy strong {
  font-size: 16px;
}

.theme-mode-copy small {
  color: var(--cp-text-muted);
}

.theme-mode-check {
  color: var(--cp-text);
}

.dialog-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dialog-header h2 {
  margin-top: 3px;
  font-size: 24px;
}

.icon-button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
}

.dialog-intro {
  margin-top: 10px;
  color: var(--cp-text-muted);
}

.account-list {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.account-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  padding: 10px;
}

.account-avatar {
  width: 38px;
  height: 38px;
}

.account-row p,
.field-help {
  color: var(--cp-text-muted);
  font-size: 12px;
}

.account-state {
  color: var(--cp-success);
  font-size: 12px;
  font-weight: 500;
}

.account-actions,
.account-logout-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-signout-button,
.danger-button {
  color: var(--cp-danger);
}

.danger-button {
  border-color: var(--cp-danger);
  background: var(--cp-surface);
}

.danger-button:hover {
  background: color-mix(in srgb, var(--cp-danger) 8%, var(--cp-surface));
}

.account-logout-confirmation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  border: 1px solid var(--cp-danger);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  padding: 12px;
}

.account-logout-confirmation p {
  margin-top: 4px;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.login-box {
  margin-top: 18px;
  border-top: 1px solid var(--cp-border);
  padding-top: 18px;
}

.login-box > label,
.crew-toolbar label,
.crew-toolbar .control-field {
  display: grid;
  gap: 5px;
  color: var(--cp-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.input-action {
  align-items: stretch;
  gap: 8px;
  margin-top: 6px;
}

.input-action input {
  min-width: 0;
  flex: 1;
}

.field-help {
  margin-top: 7px;
}

.notice {
  margin-top: 14px;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  padding: 10px 12px;
}

.notice-completed {
  border-color: var(--cp-success);
  color: var(--cp-success);
}

.notice-running {
  border-color: var(--cp-warning);
  color: var(--cp-warning);
}

.notice-failed {
  border-color: var(--cp-danger);
  color: var(--cp-danger);
}

.dashboard-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 0;
  margin-bottom: 18px;
}

.dashboard-error .secondary-button {
  flex: 0 0 auto;
}

.crew-toolbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.crew-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 16px;
}

.crew-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, 0.7fr) minmax(160px, 0.9fr);
  align-items: center;
  gap: 10px;
  border: 1px solid var(--cp-border);
  border-radius: 0.625rem;
  background: var(--cp-surface);
  padding: 9px 10px;
}

.crew-field > span {
  display: grid;
}

.crew-field > span small {
  color: var(--cp-text-muted);
}

.crew-field .crew-field-metrics {
  margin-top: 4px;
  color: var(--cp-text-soft);
  font-variant-numeric: tabular-nums;
}

.dialog-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
  border-top: 1px solid var(--cp-border);
  padding-top: 16px;
}

@media (max-width: 1600px) {
  .station-grid {
    --station-grid-columns: 4;

    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1400px) {
  .station-grid {
    --station-grid-columns: 3;

    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pipeline-feedback-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .app-shell,
  .app-shell.sidebar-collapsed {
    display: block;
  }

  .topbar-actions {
    flex-wrap: wrap;
  }

  .sidebar {
    position: sticky;
    top: 0;
    width: 100%;
    height: auto;
    padding: 0;
    border-right: 0;
    border-bottom: 1px solid var(--cp-border);
    box-shadow: none;
  }

  .sidebar-brand,
  .sidebar-collapsed .sidebar-brand {
    flex-direction: row;
    min-height: 64px;
    padding:
      8px max(20px, env(safe-area-inset-right))
      8px max(20px, env(safe-area-inset-left));
  }

  .desktop-collapse-button {
    display: none;
  }

  .mobile-menu-button {
    display: grid;
    width: 40px;
    min-width: 40px;
    height: 40px;
    margin-left: auto;
    border: 0;
    border-radius: 12px;
    background: transparent;
  }

  .mobile-menu-button:hover {
    background: var(--cp-surface-hover);
  }

  .mobile-menu-button svg {
    width: 20px;
    height: 20px;
  }

  .sidebar-scroll,
  .sidebar-account-divider,
  .sidebar-account {
    display: none;
  }

  .mobile-navigation-open .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    width: min(320px, calc(100vw - 32px));
    height: 100vh;
    height: 100dvh;
    border-right: 1px solid var(--cp-border);
    border-bottom: 0;
    box-shadow: 12px 0 32px rgba(0, 0, 0, 0.22);
    animation: drawer-enter var(--cp-motion-medium) var(--cp-motion-ease) both;
  }

  .mobile-navigation-open .sidebar-scroll {
    display: flex;
  }

  .mobile-navigation-open .sidebar-account-divider {
    display: block;
  }

  .mobile-navigation-open .sidebar-account {
    display: flex;
  }

  .mobile-navigation-backdrop {
    position: fixed;
    z-index: 35;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: rgba(0, 0, 0, 0.42);
    padding: 0;
    animation: backdrop-enter var(--cp-motion-medium) ease-out both;
  }

  .projects-nav {
    margin-top: 18px;
  }

  .project-menu-button.fui-Button {
    opacity: 1;
  }

  .metric-card {
    padding: 16px;
  }

  .pipeline-feedback-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .station-grid {
    --station-grid-columns: 2;

    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .station-heading-row {
    grid-template-columns: 1fr;
  }

  .station-filter-bar {
    width: 100%;
    justify-self: stretch;
  }

  .handoff-board {
    grid-auto-columns: auto;
    grid-auto-flow: row;
    grid-template-columns: minmax(0, 1fr);
    overflow-x: visible;
    overflow-y: visible;
    padding-bottom: 0;
    scroll-snap-type: none;
  }

  .handoff-column {
    min-height: 0;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid var(--cp-border);
  }

  .handoff-column:last-child {
    border-bottom: 0;
  }

  .handoff-column-body {
    min-height: 0;
  }

  .table-wrap {
    overflow: visible;
    border: 0;
    background: transparent;
  }

  .table-wrap table,
  .table-wrap tbody,
  .table-wrap tr,
  .table-wrap th,
  .table-wrap td {
    display: block;
    width: 100%;
  }

  .table-wrap thead {
    display: none;
  }

  .table-wrap tbody {
    display: grid;
    gap: 12px;
  }

  .table-wrap tbody tr {
    overflow: hidden;
    border: 1px solid var(--cp-border);
    border-radius: 14px;
    background: var(--cp-surface);
    box-shadow: var(--cp-card-shadow);
  }

  .table-wrap tbody th {
    border-bottom: 1px solid var(--cp-border);
    padding: 14px;
    font-size: 14px;
  }

  .table-wrap tbody td {
    display: grid;
    grid-template-columns: minmax(100px, 0.7fr) minmax(0, 1fr);
    align-items: start;
    gap: 12px;
    border-bottom: 1px solid var(--cp-border);
    padding: 9px 14px;
    text-align: left;
  }

  .table-wrap tbody td::before {
    color: var(--cp-text-muted);
    content: attr(data-label);
    font-size: 11px;
    font-weight: 600;
  }

  .table-wrap tbody td:last-child {
    border-bottom: 0;
  }

  .table-wrap .model-actions-cell {
    display: flex;
    justify-content: flex-end;
  }
}

@media (max-width: 840px) {
  .overview-heading-tools {
    width: 100%;
    align-items: flex-start;
    padding-top: 0;
  }

  .overview-heading-tools .topbar-actions {
    margin-left: 0;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 18px;
  }

  .main-content {
    padding: 20px;
  }

  .metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metrics-grid > .metric-card:last-child {
    grid-column: span 2;
  }

  .metric-card {
    padding: 14px;
  }

  .metric-value {
    font-size: 28px;
  }

  .metric-copy {
    gap: 4px;
  }

  .metric-detail {
    font-size: 11px;
    line-height: 15px;
  }

  .metric-info-button.fui-Button {
    width: 32px;
    min-width: 32px;
    height: 32px;
    flex-basis: 32px;
  }

  .pipeline-frame {
    display: block;
    min-height: 0;
    padding: 0 16px 20px;
  }

  .pipeline-view {
    display: block;
    min-height: 0;
  }

  .pipeline-toolbar {
    align-items: flex-start;
    margin-inline: -16px;
    padding-inline: 16px;
  }

  .pipeline-key {
    min-width: 100%;
    border: 0;
    background: transparent;
    justify-content: flex-start;
    padding: 0;
  }

  .pipeline-canvas-footer {
    position: static;
    display: block;
    margin-top: 12px;
    pointer-events: auto;
  }

  .pipeline-canvas-actions {
    display: none;
  }

  .pipeline-reset-button.fui-Button {
    display: none;
  }

  .pipeline-zoom-controls {
    display: none;
  }

  .pipeline-layout-wide,
  .pipeline-layout-compact,
  .pipeline-feedback-panel {
    display: none;
  }

  .pipeline-mobile-workflow {
    display: grid;
  }

  .crew-grid,
  .crew-toolbar,
  .theme-mode-grid,
  .settings-layout,
  .command-grid {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    flex-direction: row;
    border-right: 0;
    border-bottom: 1px solid var(--cp-border);
    padding-right: 0;
    padding-bottom: 12px;
  }

  .settings-nav-button {
    flex: 1;
  }

}

@media (max-width: 600px) {
  .topbar-actions {
    width: 100%;
    gap: 8px;
  }

  .range-picker,
  .range-picker .range-select,
  .topbar-actions > .secondary-button:not(.refresh-button) {
    flex: 1;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .main-content {
    padding: 16px;
  }

  .page-heading h2 {
    font-size: 26px;
  }

  .page-heading p:last-child {
    font-size: 13px;
    line-height: 19px;
  }

  .live-state {
    font-size: 11px;
  }

  .metric-card {
    padding: 12px;
  }

  .station-grid {
    --station-grid-columns: 1;

    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-note {
    text-align: left;
  }

  .station-purpose {
    min-height: auto;
  }

  .process-row {
    grid-template-columns: 10px minmax(0, 1fr);
  }

  .process-time {
    grid-column: 2;
    grid-auto-flow: column;
    justify-content: start;
    justify-items: start;
  }

  .smoke-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .smoke-row span,
  .smoke-row small {
    grid-column: 2;
  }

  .dialog-backdrop {
    align-items: end;
    padding: 0;
  }

  .dialog,
  .dialog-wide,
  .settings-dialog,
  .command-dialog {
    width: 100%;
    max-height: 94vh;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 16px 16px 0 0;
  }

  .input-action {
    align-items: stretch;
    flex-direction: column;
  }

  .account-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .account-state,
  .account-actions {
    grid-column: 2;
    justify-self: start;
  }

  .account-actions,
  .account-logout-confirmation {
    align-items: stretch;
    flex-direction: column;
  }

  .crew-field {
    grid-template-columns: 1fr;
  }

  .dialog-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .project-settings-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .project-settings-row > .secondary-button {
    grid-column: 1 / -1;
    justify-self: stretch;
  }
}

@media (max-width: 360px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid > .metric-card:last-child {
    grid-column: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  .skeleton-block::after,
  .skeleton-line::after {
    display: none;
  }

  ::view-transition-old(dashboard-content),
  ::view-transition-new(dashboard-content) {
    animation: none;
  }

  .pipeline-world {
    transition: none !important;
  }
}
`;
