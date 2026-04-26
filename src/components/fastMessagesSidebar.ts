/*
 * Fast Messages Sidebar
 *
 * A vertical menu pinned to the right side of the chat interface that holds a
 * scrollable list of clickable predefined messages. Clicking a slot inserts the
 * message into the currently focused chat input. The list can be edited by the
 * user (add / remove / reorder / edit text) and is persisted via the same app
 * settings store the rest of the client uses, so it survives page refreshes.
 *
 * A footer button opens the existing Language Format Settings tab.
 */

import {createEffect, createRoot, on} from 'solid-js';
import {unwrap} from 'solid-js/store';
import appImManager from '@lib/appImManager';
import appSidebarRight from '@components/sidebarRight';
import {useAppSettings} from '@stores/appSettings';

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

const openLanguageFormatSettings = async() => {
  const {default: AppLanguageFormatSettingsTab} = await import(
    '@components/sidebarLeft/tabs/languageFormatSettings'
  );
  const tab = appSidebarRight.createTab(AppLanguageFormatSettingsTab);
  tab.open();
  appSidebarRight.toggleSidebar(true);
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
  title.textContent = 'Fast Messages';

  const subtitle = document.createElement('div');
  subtitle.className = 'fast-sidebar__subtitle';
  subtitle.textContent = 'Click a message to insert it';

  titleWrap.append(title, subtitle);

  const editToggle = document.createElement('button');
  editToggle.type = 'button';
  editToggle.className = 'fast-sidebar__edit-toggle';
  editToggle.textContent = 'Edit';

  headerRow.append(titleWrap, editToggle);
  header.append(headerRow);

  const list = document.createElement('div');
  list.className = 'fast-sidebar__list';

  const footer = document.createElement('div');
  footer.className = 'fast-sidebar__footer';

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'fast-sidebar__btn';
  langBtn.textContent = 'Language Format Settings';
  langBtn.addEventListener('click', () => {
    openLanguageFormatSettings().catch((err) => {
      console.error('[fast-sidebar] failed to open language format settings', err);
    });
  });

  footer.append(langBtn);

  root.append(header, list, footer);
  container.append(root);

  // -- State ------------------------------------------------------------------
  let editing = false;

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

  // -- Rendering --------------------------------------------------------------
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

  editToggle.addEventListener('click', () => {
    editing = !editing;
    editToggle.textContent = editing ? 'Done' : 'Edit';
    editToggle.classList.toggle('is-active', editing);
    subtitle.textContent = editing ?
      'Edit, reorder or remove messages' :
      'Click a message to insert it';
    renderList();
  });

  // React to settings changes (initial load + saves) via a Solid effect.
  createRoot(() => {
    createEffect(on(() => unwrap(appSettings.fastMessages), () => {
      renderList();
    }));
  });
};

export default initFastMessagesSidebar;
