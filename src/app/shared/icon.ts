import { Component, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'boards'
  | 'tasks'
  | 'chat'
  | 'settings'
  | 'logout'
  | 'menu'
  | 'close'
  | 'plus'
  | 'search'
  | 'arrow-right'
  | 'arrow-left'
  | 'sparkle'
  | 'lock'
  | 'users'
  | 'calendar'
  | 'check';

@Component({
  selector: 'app-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('home') {
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        }
        @case ('boards') {
          <rect x="3" y="3" width="7" height="18" rx="1.5" />
          <rect x="14" y="3" width="7" height="10" rx="1.5" />
        }
        @case ('tasks') {
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        }
        @case ('chat') {
          <path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"
          />
        }
        @case ('logout') {
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        }
        @case ('menu') {
          <path d="M4 7h16M4 12h16M4 17h16" />
        }
        @case ('close') {
          <path d="m6 6 12 12M18 6 6 18" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        }
        @case ('arrow-right') {
          <path d="M5 12h14m-5-5 5 5-5 5" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5m5-5-5 5 5 5" />
        }
        @case ('sparkle') {
          <path
            d="M12 2c.8 5.4 4.6 9.2 10 10-5.4.8-9.2 4.6-10 10-.8-5.4-4.6-9.2-10-10 5.4-.8 9.2-4.6 10-10Z"
          />
        }
        @case ('lock') {
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        }
        @case ('check') {
          <path d="m5 12 4 4L19 6" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 1.25em;
        height: 1.25em;
        flex: 0 0 auto;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<IconName>();
}
