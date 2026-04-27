/*
 * Fast Messages Sidebar (tabbed)
 *
 * A vertical menu pinned to the right side of the chat interface that holds
 * two tabs:
 *   1) Fast Messages — a scrollable list of clickable predefined messages
 *      with edit/reorder/delete and per-device add/remove. The list is also
 *      synced to the user's Saved Messages chat (hidden pinned message) so
 *      it follows them across devices.
 *   2) Language Format — the same options exposed by the Language Format
 *      Settings tab, rendered inline so the user no longer needs the topbar
 *      icon to reach them.
 */

import {createEffect, createRoot, on} from 'solid-js';
import {unwrap} from 'solid-js/store';
import appImManager from '@lib/appImManager';
import {setAppSettings, useAppSettings} from '@stores/appSettings';
import initFastMessagesCloudSync from '@lib/fastMessagesCloudSync';
import initFastMessagesAutoReply from '@lib/fastMessagesAutoReply';
import {normaliseFastMessages} from '@lib/fastMessagesUtils';
import type {FastMessageMatchMode, FastMessageRule} from '@config/state';

const DEFAULT_FAST_MESSAGES: FastMessageRule[] = [
  {trigger: 'hi', reply: 'Hello! 👋 How are you today?', match: 'contains'},
  {trigger: 'message', reply: 'Thanks for your message, I will get back to you soon.', match: 'contains'},
  {trigger: 'busy', reply: 'Sorry, I am busy right now. Can we talk later?', match: 'contains'},
  {trigger: 'thanks', reply: 'Got it, thanks!', match: 'contains'},
  {trigger: 'where are you', reply: 'On my way 🚗', match: 'contains'},
  {trigger: 'details', reply: 'Please send me the details.', match: 'contains'},
  {trigger: 'ok', reply: 'Sounds good to me 👍', match: 'exact'},
  {trigger: 'check', reply: 'Let me check and confirm.', match: 'contains'},
  {trigger: 'have a good day', reply: 'Have a great day! 🌟', match: 'contains'},
  {trigger: 'good morning', reply: 'Good morning! ☀️', match: 'contains'},
  {trigger: 'good night', reply: 'Good night 🌙', match: 'contains'},
  {trigger: 'birthday', reply: 'Happy birthday! 🎉🎂', match: 'contains'},
  {trigger: 'congrats', reply: 'Congratulations! 🎊', match: 'contains'},
  {trigger: 'meeting', reply: 'I am in a meeting. Will reply later.', match: 'contains'},
  {trigger: 'phone number', reply: 'Please share your phone number.', match: 'contains'},
  {trigger: 'where are you?', reply: 'Where are you?', match: 'exact'},
  {trigger: 'works for you', reply: 'Yes, that works for me.', match: 'contains'},
  {trigger: 'sorry', reply: 'No problem at all 🙂', match: 'contains'},
  {trigger: 'thank you', reply: 'I appreciate your help, thank you!', match: 'contains'},
  {trigger: 'bye', reply: 'Talk to you soon 👋', match: 'contains'}
];

const MATCH_OPTIONS: {value: FastMessageMatchMode, label: string}[] = [
  {value: 'exact', label: 'Exact match'},
  {value: 'contains', label: 'Contains'},
  {value: 'startsWith', label: 'Starts with'}
];

type LangOption = {code: string, label: string};

const MY_LANGUAGES: LangOption[] = [
  {code: 'my', label: 'Burmese'},
  {code: 'en', label: 'English'},
  {code: 'th', label: 'Thai'},
  {code: 'zh', label: 'Chinese'},
  {code: 'es', label: 'Spanish'},
  {code: 'fr', label: 'French'},
  {code: 'ru', label: 'Russian'},
  {code: 'ar', label: 'Arabic'},
  {code: 'hi', label: 'Hindi'},
  {code: 'ja', label: 'Japanese'},
  {code: 'ko', label: 'Korean'},
  {code: 'pt', label: 'Portuguese'},
  {code: 'de', label: 'German'},
  {code: 'it', label: 'Italian'},
  {code: 'vi', label: 'Vietnamese'},
  {code: 'id', label: 'Indonesian'},
  {code: 'tr', label: 'Turkish'}
];

const CLIENT_LANGUAGES: LangOption[] = [
  {code: 'es-MX', label: 'Spanish / Mexico'},
  {code: 'es-ES', label: 'Spanish / Spain'},
  {code: 'es-AR', label: 'Spanish / Argentina'},
  {code: 'en-US', label: 'English / US'},
  {code: 'en-GB', label: 'English / UK'},
  {code: 'pt-BR', label: 'Portuguese / Brazil'},
  {code: 'pt-PT', label: 'Portuguese / Portugal'},
  {code: 'zh-CN', label: 'Chinese / Simplified'},
  {code: 'zh-TW', label: 'Chinese / Traditional'},
  {code: 'fr-FR', label: 'French / France'},
  {code: 'de-DE', label: 'German / Germany'},
  {code: 'ja-JP', label: 'Japanese / Japan'},
  {code: 'ko-KR', label: 'Korean / Korea'},
  {code: 'ru-RU', label: 'Russian / Russia'},
  {code: 'ar-SA', label: 'Arabic / Saudi Arabia'},
  {code: 'hi-IN', label: 'Hindi / India'},
  {code: 'th-TH', label: 'Thai / Thailand'},
  {code: 'vi-VN', label: 'Vietnamese / Vietnam'},
  {code: 'id-ID', label: 'Indonesian / Indonesia'},
  {code: 'tr-TR', label: 'Turkish / Turkey'},
  {code: 'my-MM', label: 'Burmese / Myanmar'}
];

const LAYOUT_STYLES: {value: 'custom', label: string}[] = [
  {value: 'custom', label: 'Custom (Incoming: Orig-Top, Outgoing: Trans-Top)'}
];

let initialized = false;

// Bridge so external triggers (the chat top bar's More-actions submenu) can
// open the sidebar pre-selected to a specific tab. Wired up from
// initFastMessagesSidebar() once the DOM is mounted.
let _setActiveTabFromOutside: ((id: 'fast' | 'lang') => void) | null = null;

export const openFastMessagesSidebarTab = (tab: 'fast' | 'lang') => {
  setAppSettings('fastMessagesSidebarOpen', true);
  _setActiveTabFromOutside?.(tab);
};

const insertFastMessage = (text: string) => {
  const chat = appImManager.chat;
  const input = chat?.input;

  if(!input?.messageInput) {
    return;
  }

  // Focus the input first so insertAtCaret has a valid selection.
  input.messageInput.focus();
  input.insertAtCaret(text, undefined, false);
};

type TabId = 'fast' | 'lang';

type TabHeader = {
  title: string;
  subtitle: string;
};

const TAB_HEADERS: Record<TabId, TabHeader> = {
  fast: {title: 'Fast Messages', subtitle: 'Click a message to insert it'},
  lang: {title: 'Language Format', subtitle: 'Configure two-way translation'}
};

export const initFastMessagesSidebar = () => {
  if(initialized) return;

  const container = document.getElementById('column-fast');
  if(!container) return;

  initialized = true;

  const [appSettings, setAppSettings] = useAppSettings();

  // Seed defaults for users whose stored state predates the fastMessages key.
  // Also migrate legacy `string[]` entries into the new {trigger, reply, match}
  // rule shape so older devices/state files keep working.
  if(!Array.isArray(appSettings.fastMessages)) {
    setAppSettings('fastMessages', DEFAULT_FAST_MESSAGES.map((r) => ({...r})));
  } else {
    const normalised = normaliseFastMessages(appSettings.fastMessages);
    const before = JSON.stringify(appSettings.fastMessages);
    const after = JSON.stringify(normalised);
    if(before !== after) {
      setAppSettings('fastMessages', normalised);
    }
  }

  // Kick off cross-device sync via Saved Messages.
  initFastMessagesCloudSync();

  // Start the auto-reply listener (it self-gates on the appSettings.autoReply
  // toggle, so it is safe to init unconditionally).
  initFastMessagesAutoReply();

  // -- DOM scaffolding --------------------------------------------------------
  const root = document.createElement('div');
  root.className = 'fast-sidebar';

  const header = document.createElement('div');
  header.className = 'fast-sidebar__header';

  const headerRow = document.createElement('div');
  headerRow.className = 'fast-sidebar__header-row';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'fast-sidebar__title-wrap';

  const title = document.createElement('div');
  title.className = 'fast-sidebar__title';

  const subtitle = document.createElement('div');
  subtitle.className = 'fast-sidebar__subtitle';

  titleWrap.append(title, subtitle);

  const headerActions = document.createElement('div');
  headerActions.className = 'fast-sidebar__header-actions';

  const autoReplyToggle = document.createElement('button');
  autoReplyToggle.type = 'button';
  autoReplyToggle.className = 'fast-sidebar__auto-reply-toggle';
  autoReplyToggle.title = 'Toggle Quick Auto Reply';

  const autoReplyDot = document.createElement('span');
  autoReplyDot.className = 'fast-sidebar__auto-reply-dot';
  const autoReplyLabel = document.createElement('span');
  autoReplyLabel.className = 'fast-sidebar__auto-reply-label';
  autoReplyLabel.textContent = 'Auto Reply';
  const autoReplyState = document.createElement('span');
  autoReplyState.className = 'fast-sidebar__auto-reply-state';
  autoReplyToggle.append(autoReplyDot, autoReplyLabel, autoReplyState);

  const editToggle = document.createElement('button');
  editToggle.type = 'button';
  editToggle.className = 'fast-sidebar__edit-toggle';
  editToggle.textContent = 'Edit';

  headerActions.append(autoReplyToggle, editToggle);
  headerRow.append(titleWrap, headerActions);
  header.append(headerRow);

  // Tab strip --------------------------------------------------------------
  const tabs = document.createElement('div');
  tabs.className = 'fast-sidebar__tabs';
  tabs.setAttribute('role', 'tablist');

  const fastTabBtn = document.createElement('button');
  fastTabBtn.type = 'button';
  fastTabBtn.className = 'fast-sidebar__tab';
  fastTabBtn.dataset.tab = 'fast';
  fastTabBtn.setAttribute('role', 'tab');
  fastTabBtn.textContent = 'Fast Messages';

  const langTabBtn = document.createElement('button');
  langTabBtn.type = 'button';
  langTabBtn.className = 'fast-sidebar__tab';
  langTabBtn.dataset.tab = 'lang';
  langTabBtn.setAttribute('role', 'tab');
  langTabBtn.textContent = 'Language Format';

  tabs.append(fastTabBtn, langTabBtn);

  // Panels -----------------------------------------------------------------
  const panels = document.createElement('div');
  panels.className = 'fast-sidebar__panels';

  const fastPanel = document.createElement('div');
  fastPanel.className = 'fast-sidebar__panel fast-sidebar__panel--fast';
  fastPanel.setAttribute('role', 'tabpanel');

  const list = document.createElement('div');
  list.className = 'fast-sidebar__list';
  fastPanel.append(list);

  const langPanel = document.createElement('div');
  langPanel.className = 'fast-sidebar__panel fast-sidebar__panel--lang';
  langPanel.setAttribute('role', 'tabpanel');

  panels.append(fastPanel, langPanel);

  root.append(header, tabs, panels);
  container.append(root);

  // -- State ------------------------------------------------------------------
  let editing = false;
  let activeTab: TabId = 'fast';

  const persist = (next: FastMessageRule[]) => {
    setAppSettings('fastMessages', next);
  };

  const cloneCurrent = (): FastMessageRule[] =>
    normaliseFastMessages(appSettings.fastMessages).map((r) => ({...r}));

  const updateRule = (index: number, patch: Partial<FastMessageRule>) => {
    const current = cloneCurrent();
    if(!current[index]) return;
    current[index] = {...current[index], ...patch};
    persist(current);
  };

  const removeMessage = (index: number) => {
    const current = cloneCurrent();
    current.splice(index, 1);
    persist(current);
  };

  const moveMessage = (index: number, direction: -1 | 1) => {
    const current = cloneCurrent();
    const target = index + direction;
    if(target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    persist(current);
  };

  const addMessage = () => {
    const current = cloneCurrent();
    current.push({trigger: '', reply: 'New fast message', match: 'contains'});
    persist(current);
  };

  // -- Rendering: Fast Messages ----------------------------------------------
  const renderViewSlot = (rule: FastMessageRule): HTMLElement => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'fast-sidebar__slot';
    slot.title = 'Click to insert into the message box';

    const replyText = document.createElement('div');
    replyText.className = 'fast-sidebar__slot-reply';
    replyText.textContent = rule.reply;
    slot.append(replyText);

    if(rule.trigger) {
      const meta = document.createElement('div');
      meta.className = 'fast-sidebar__slot-meta';
      const modeLabel = MATCH_OPTIONS.find((o) => o.value === rule.match)?.label ?? rule.match;
      meta.textContent = `Trigger (${modeLabel}): "${rule.trigger}"`;
      slot.append(meta);
    }

    slot.addEventListener('click', () => insertFastMessage(rule.reply));
    return slot;
  };

  const renderEditSlot = (rule: FastMessageRule, index: number, total: number): HTMLElement => {
    const slot = document.createElement('div');
    slot.className = 'fast-sidebar__slot fast-sidebar__slot--editing';

    // Trigger row: keyword input + match-mode select.
    const triggerRow = document.createElement('div');
    triggerRow.className = 'fast-sidebar__slot-trigger-row';

    const triggerInput = document.createElement('input');
    triggerInput.type = 'text';
    triggerInput.className = 'fast-sidebar__slot-trigger-input';
    triggerInput.value = rule.trigger;
    triggerInput.placeholder = 'Trigger keyword';
    triggerInput.addEventListener('change', () => {
      updateRule(index, {trigger: triggerInput.value});
    });
    triggerInput.addEventListener('blur', () => {
      if(triggerInput.value !== rule.trigger) {
        updateRule(index, {trigger: triggerInput.value});
      }
    });

    const modeSelect = document.createElement('select');
    modeSelect.className = 'fast-sidebar__slot-mode-select';
    modeSelect.title = 'Matching mode';
    for(const opt of MATCH_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if(opt.value === rule.match) o.selected = true;
      modeSelect.append(o);
    }
    modeSelect.addEventListener('change', () => {
      updateRule(index, {match: modeSelect.value as FastMessageMatchMode});
    });

    triggerRow.append(triggerInput, modeSelect);

    // Reply row: textarea + side action buttons.
    const replyRow = document.createElement('div');
    replyRow.className = 'fast-sidebar__slot-reply-row';

    const textarea = document.createElement('textarea');
    textarea.className = 'fast-sidebar__slot-input';
    textarea.value = rule.reply;
    textarea.rows = 2;
    textarea.placeholder = 'Reply text';
    textarea.addEventListener('change', () => {
      updateRule(index, {reply: textarea.value});
    });
    textarea.addEventListener('blur', () => {
      if(textarea.value !== rule.reply) {
        updateRule(index, {reply: textarea.value});
      }
    });

    const actions = document.createElement('div');
    actions.className = 'fast-sidebar__slot-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'fast-sidebar__icon-btn';
    upBtn.title = 'Move up';
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveMessage(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'fast-sidebar__icon-btn';
    downBtn.title = 'Move down';
    downBtn.textContent = '▼';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', () => moveMessage(index, 1));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'fast-sidebar__icon-btn fast-sidebar__icon-btn--danger';
    delBtn.title = 'Delete';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => removeMessage(index));

    actions.append(upBtn, downBtn, delBtn);
    replyRow.append(textarea, actions);

    slot.append(triggerRow, replyRow);
    return slot;
  };

  const renderList = () => {
    list.innerHTML = '';
    const messages = normaliseFastMessages(appSettings.fastMessages);

    if(messages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fast-sidebar__empty';
      empty.textContent = editing ?
        'No messages yet. Click "Add" below to create one.' :
        'No fast messages. Click Edit to add some.';
      list.append(empty);
    } else if(editing) {
      messages.forEach((rule, index) => {
        list.append(renderEditSlot(rule, index, messages.length));
      });
    } else {
      messages.forEach((rule) => {
        list.append(renderViewSlot(rule));
      });
    }

    if(editing) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'fast-sidebar__add-btn';
      addBtn.textContent = '+ Add fast message';
      addBtn.addEventListener('click', () => addMessage());
      list.append(addBtn);
    }
  };

  // -- Rendering: Language Format -------------------------------------------
  const renderLanguagePanel = () => {
    langPanel.innerHTML = '';

    const buildToggleRow = (
      labelText: string,
      get: () => boolean,
      set: (next: boolean) => void
    ) => {
      const row = document.createElement('label');
      row.className = 'fast-sidebar__lang-row';

      const label = document.createElement('span');
      label.className = 'fast-sidebar__lang-row-label';
      label.textContent = labelText;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'fast-sidebar__lang-toggle';
      input.checked = !!get();
      input.addEventListener('change', () => set(input.checked));

      row.append(label, input);
      return row;
    };

    const buildSelectRow = <T extends string>(
      labelText: string,
      options: {value: T, label: string}[],
      get: () => T,
      set: (value: T) => void
    ) => {
      const row = document.createElement('div');
      row.className = 'fast-sidebar__lang-row';

      const label = document.createElement('span');
      label.className = 'fast-sidebar__lang-row-label';
      label.textContent = labelText;

      const select = document.createElement('select');
      select.className = 'fast-sidebar__lang-select';
      const current = get();
      let hasMatch = false;
      for(const opt of options) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if(opt.value === current) {
          o.selected = true;
          hasMatch = true;
        }
        select.append(o);
      }
      if(!hasMatch && options.length) {
        select.value = options[0].value;
      }
      select.addEventListener('change', () => set(select.value as T));

      row.append(label, select);
      return row;
    };

    const lf = appSettings.languageFormat ?? {} as any;

    const sectionToggles = document.createElement('div');
    sectionToggles.className = 'fast-sidebar__lang-section';

    const sectionTogglesTitle = document.createElement('div');
    sectionTogglesTitle.className = 'fast-sidebar__lang-section-title';
    sectionTogglesTitle.textContent = 'Two-Way Translation';
    sectionToggles.append(sectionTogglesTitle);

    sectionToggles.append(buildToggleRow(
      'Enable two-way translation',
      () => !!lf.enabled,
      (v) => setAppSettings('languageFormat', 'enabled', v)
    ));
    sectionToggles.append(buildToggleRow(
      'Auto-translate voice messages',
      () => !!lf.autoTranslateVoice,
      (v) => setAppSettings('languageFormat', 'autoTranslateVoice', v)
    ));

    const sectionLangs = document.createElement('div');
    sectionLangs.className = 'fast-sidebar__lang-section';

    const sectionLangsTitle = document.createElement('div');
    sectionLangsTitle.className = 'fast-sidebar__lang-section-title';
    sectionLangsTitle.textContent = 'Languages';
    sectionLangs.append(sectionLangsTitle);

    sectionLangs.append(buildSelectRow(
      'Your language',
      MY_LANGUAGES.map((o) => ({value: o.code, label: o.label})),
      () => (lf.myLanguage ?? 'my') as string,
      (v) => setAppSettings('languageFormat', 'myLanguage', v)
    ));
    sectionLangs.append(buildSelectRow(
      'Client language',
      CLIENT_LANGUAGES.map((o) => ({value: o.code, label: o.label})),
      () => (lf.clientLanguage ?? 'es-MX') as string,
      (v) => setAppSettings('languageFormat', 'clientLanguage', v)
    ));
    sectionLangs.append(buildSelectRow(
      'Layout style',
      LAYOUT_STYLES.map((o) => ({value: o.value, label: o.label})),
      () => (lf.layoutStyle ?? 'custom') as 'custom',
      (v) => setAppSettings('languageFormat', 'layoutStyle', v)
    ));

    langPanel.append(sectionToggles, sectionLangs);
  };

  // -- Tab control ----------------------------------------------------------
  const setActiveTab = (id: TabId) => {
    activeTab = id;
    fastTabBtn.classList.toggle('is-active', id === 'fast');
    langTabBtn.classList.toggle('is-active', id === 'lang');
    fastTabBtn.setAttribute('aria-selected', String(id === 'fast'));
    langTabBtn.setAttribute('aria-selected', String(id === 'lang'));
    fastPanel.classList.toggle('is-active', id === 'fast');
    langPanel.classList.toggle('is-active', id === 'lang');

    // Edit toggle is only meaningful on the Fast Messages tab.
    editToggle.style.display = id === 'fast' ? '' : 'none';

    refreshHeader();

    if(id === 'lang') {
      renderLanguagePanel();
    }
  };

  // Expose tab selection to the chat top bar's More-actions submenu.
  _setActiveTabFromOutside = setActiveTab;

  const refreshHeader = () => {
    const base = TAB_HEADERS[activeTab];
    title.textContent = base.title;
    if(activeTab === 'fast') {
      subtitle.textContent = editing ?
        'Edit, reorder or remove messages' :
        base.subtitle;
    } else {
      subtitle.textContent = base.subtitle;
    }
  };

  fastTabBtn.addEventListener('click', () => setActiveTab('fast'));
  langTabBtn.addEventListener('click', () => setActiveTab('lang'));

  const refreshAutoReplyToggle = () => {
    const on = !!appSettings.autoReply;
    autoReplyToggle.classList.toggle('is-on', on);
    autoReplyToggle.setAttribute('aria-pressed', String(on));
    autoReplyState.textContent = on ? 'On' : 'Off';
  };

  autoReplyToggle.addEventListener('click', () => {
    setAppSettings('autoReply', !appSettings.autoReply);
  });

  editToggle.addEventListener('click', () => {
    editing = !editing;
    editToggle.textContent = editing ? 'Done' : 'Edit';
    editToggle.classList.toggle('is-active', editing);
    refreshHeader();
    renderList();
  });

  // React to settings changes (initial load + saves) via Solid effects so the
  // UI always reflects the current store contents.
  createRoot(() => {
    createEffect(on(() => unwrap(appSettings.fastMessages), () => {
      if(activeTab === 'fast') renderList();
    }));
    createEffect(on(() => unwrap(appSettings.languageFormat), () => {
      if(activeTab === 'lang') renderLanguagePanel();
    }));
    createEffect(on(() => appSettings.autoReply, () => {
      refreshAutoReplyToggle();
    }));
    // Toggle body class so the SCSS can show/hide the column and reclaim the
    // reserved horizontal space when the sidebar is closed. Driven by the
    // "Toggle Fast Messages" entry in the chat top bar's More-actions menu.
    createEffect(on(() => appSettings.fastMessagesSidebarOpen, (open) => {
      document.body.classList.toggle('fast-sidebar-open', !!open);
    }));
  });

  setActiveTab('fast');
  refreshAutoReplyToggle();
};

export default initFastMessagesSidebar;
