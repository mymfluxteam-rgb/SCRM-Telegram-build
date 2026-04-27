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
import {useAppSettings} from '@stores/appSettings';
import initFastMessagesCloudSync from '@lib/fastMessagesCloudSync';
import initFastMessagesAutoReply from '@lib/fastMessagesAutoReply';

const DEFAULT_FAST_MESSAGES: string[] = [
  'Hello! 👋 How are you today?',
  'Thanks for your message, I will get back to you soon.',
  'Sorry, I am busy right now. Can we talk later?',
  'Got it, thanks!',
  'On my way 🚗',
  'Please send me the details.',
  'Sounds good to me 👍',
  'Let me check and confirm.',
  'Have a great day! 🌟',
  'Good morning! ☀️',
  'Good night 🌙',
  'Happy birthday! 🎉🎂',
  'Congratulations! 🎊',
  'I am in a meeting. Will reply later.',
  'Please share your phone number.',
  'Where are you?',
  'Yes, that works for me.',
  'No problem at all 🙂',
  'I appreciate your help, thank you!',
  'Talk to you soon 👋'
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
  if(!Array.isArray(appSettings.fastMessages)) {
    setAppSettings('fastMessages', DEFAULT_FAST_MESSAGES.slice());
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

  const persist = (next: string[]) => {
    setAppSettings('fastMessages', next);
  };

  const updateMessage = (index: number, text: string) => {
    const current = (appSettings.fastMessages ?? []).slice();
    current[index] = text;
    persist(current);
  };

  const removeMessage = (index: number) => {
    const current = (appSettings.fastMessages ?? []).slice();
    current.splice(index, 1);
    persist(current);
  };

  const moveMessage = (index: number, direction: -1 | 1) => {
    const current = (appSettings.fastMessages ?? []).slice();
    const target = index + direction;
    if(target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    persist(current);
  };

  const addMessage = () => {
    const current = (appSettings.fastMessages ?? []).slice();
    current.push('New fast message');
    persist(current);
  };

  // -- Rendering: Fast Messages ----------------------------------------------
  const renderViewSlot = (text: string): HTMLElement => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'fast-sidebar__slot';
    slot.textContent = text;
    slot.title = 'Click to insert into the message box';
    slot.addEventListener('click', () => insertFastMessage(text));
    return slot;
  };

  const renderEditSlot = (text: string, index: number, total: number): HTMLElement => {
    const slot = document.createElement('div');
    slot.className = 'fast-sidebar__slot fast-sidebar__slot--editing';

    const textarea = document.createElement('textarea');
    textarea.className = 'fast-sidebar__slot-input';
    textarea.value = text;
    textarea.rows = 2;
    textarea.placeholder = 'Message text';
    textarea.addEventListener('change', () => {
      updateMessage(index, textarea.value);
    });
    textarea.addEventListener('blur', () => {
      if(textarea.value !== text) {
        updateMessage(index, textarea.value);
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
    slot.append(textarea, actions);
    return slot;
  };

  const renderList = () => {
    list.innerHTML = '';
    const messages = appSettings.fastMessages ?? [];

    if(messages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fast-sidebar__empty';
      empty.textContent = editing ?
        'No messages yet. Click "Add" below to create one.' :
        'No fast messages. Click Edit to add some.';
      list.append(empty);
    } else if(editing) {
      messages.forEach((text, index) => {
        list.append(renderEditSlot(text, index, messages.length));
      });
    } else {
      messages.forEach((text) => {
        list.append(renderViewSlot(text));
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
  });

  setActiveTab('fast');
  refreshAutoReplyToggle();
};

export default initFastMessagesSidebar;
