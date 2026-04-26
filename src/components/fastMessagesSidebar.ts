/*
 * Fast Messages Sidebar
 *
 * A vertical menu pinned to the right side of the chat interface that holds a
 * scrollable list of clickable predefined messages. Clicking a slot inserts the
 * message into the currently focused chat input. A footer button opens the
 * existing Language Format Settings tab.
 */

import appImManager from '@lib/appImManager';
import appSidebarRight from '@components/sidebarRight';

const FAST_MESSAGES: string[] = [
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

const buildSlot = (text: string): HTMLButtonElement => {
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = 'fast-sidebar__slot';
  slot.textContent = text;
  slot.title = 'Click to insert into the message box';
  slot.addEventListener('click', () => insertFastMessage(text));
  return slot;
};

export const initFastMessagesSidebar = () => {
  if(initialized) return;

  const container = document.getElementById('column-fast');
  if(!container) return;

  initialized = true;

  const root = document.createElement('div');
  root.className = 'fast-sidebar';

  const header = document.createElement('div');
  header.className = 'fast-sidebar__header';

  const title = document.createElement('div');
  title.className = 'fast-sidebar__title';
  title.textContent = 'Fast Messages';

  const subtitle = document.createElement('div');
  subtitle.className = 'fast-sidebar__subtitle';
  subtitle.textContent = 'Click a message to insert it into the chat';

  header.append(title, subtitle);

  const list = document.createElement('div');
  list.className = 'fast-sidebar__list';
  for(const text of FAST_MESSAGES) {
    list.append(buildSlot(text));
  }

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
};

export default initFastMessagesSidebar;
