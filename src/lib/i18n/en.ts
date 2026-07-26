// English is the single source of truth for every UI string in the app.
// Other languages (see src/lib/translate.ts -> COMMON_LANGUAGES) are added
// here as sibling objects with the exact same keys. Until a language has an
// entry below, the app falls back to English automatically — nothing ever
// renders blank.
//
// This dictionary only covers UI chrome (buttons, labels, nav, messages).
// It intentionally does NOT cover documentation/blog content, which has its
// own per-section translate flow (see TranslateButton.tsx) since that
// content is user-authored, not part of the app itself.

export const en = {
  nav: {
    blog: 'Blog',
    dashboard: 'Dashboard',
    signIn: 'Sign in',
    signUp: 'Sign up',
    myProjects: 'My projects',
    account: 'Account',
    signOut: 'Sign out',
    search: 'Search',
  },
  landing: {
    badge: 'Built for teams who write docs together',
    heading1: 'Docs your team',
    heading2: 'actually keeps up to date.',
    subheading:
      "Write once, find it instantly, and never let a guide go stale. DOCLIX is a collaborative documentation workspace with search built into its bones.",
    ctaSignedOut: "Document anything — it's free",
    ctaSignedIn: 'Go to your projects',
    ctaSecondary: 'See how it works',
    searchPlaceholder: 'Search any public project or section…',
    searchHint: 'This is a live search — try a real term from any public DOCLIX project.',
    searchEmpty: 'No results yet — try another term.',
    searchTooShort: 'Keep typing to search live docs.',
    featuresHeading: "Everything a docs site needs. Nothing it doesn't.",
    featuresSubheading: "Three things make DOCLIX different from a folder of markdown files.",
    footerCtaHeading: 'Your next doc is one section away.',
    footerCtaSubheading: 'Free to start. No credit card, no setup call, no excuses left.',
    footerTagline: 'DOCLIX — documentation, done together.',
    footerBlogLink: 'Read the blog',
    features: {
      search: {
        title: 'Search that actually finds things',
        description:
          "Every project and section is indexed the moment it's saved. Press ⌘K anywhere to search titles and body text at once.",
      },
      reorder: {
        title: 'Reorder without touching files',
        description:
          'Drag sections into place in the sidebar. Structure changes are saved instantly — no renaming files or editing a nav config.',
      },
      autosave: {
        title: 'Auto-save, real undo',
        description:
          'Every keystroke is debounced and saved for you, with full undo and redo history — so nothing you write is ever at risk.',
      },
      importFile: {
        title: 'Import what you already wrote',
        description:
          "Drop in a .md or .txt file and DOCLIX splits it into sections automatically at each heading, ready to edit.",
      },
      publicByDefault: {
        title: 'Public by default, yours to edit',
        description:
          'Anyone can read and search your docs without an account. Only you can make changes, gated behind real project ownership.',
      },
      readyFast: {
        title: 'Ready in a minute',
        description:
          "No servers to configure. Create a project, add a section, and you have a URL worth sharing before your coffee's cold.",
      },
    },
  },
  settings: {
    title: 'Account settings',
    profileTitle: 'Profile',
    profileDescription: 'Your display name, shown across DOCLIX.',
    emailTitle: 'Email address',
    emailDescription: 'Used to sign in and for account notifications.',
    passwordTitle: 'Password',
    passwordDescription: 'Change the password used to sign in.',
    languageTitle: 'Language',
    languageDescription: 'Choose the language DOCLIX is displayed in.',
    languageNote:
      'This translates the DOCLIX interface — buttons, menus, and labels. Documentation content can be translated separately from the translate button on each page.',
    dangerTitle: 'Danger zone',
    dangerDescription: 'Permanently delete your account and all your projects.',
    save: 'Save',
    saving: 'Saving…',
    deleteAccount: 'Delete account',
    signOut: 'Sign out',
  },
  common: {
    cancel: 'Cancel',
    loading: 'Loading…',
  },
} as const;

export type Dictionary = typeof en;
