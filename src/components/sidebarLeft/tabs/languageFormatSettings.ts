import {joinDeepPath} from '@helpers/object/setDeepProperty';
import createContextMenu from '@helpers/dom/createContextMenu';
import CheckboxField from '@components/checkboxField';
import Row from '@components/row';
import SettingSection from '@components/settingSection';
import SliderSuperTab from '@components/sliderTab';
import {useAppSettings} from '@stores/appSettings';

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

export default class AppLanguageFormatSettingsTab extends SliderSuperTab {
  public init() {
    this.container.classList.add('language-format-settings-container');
    this.setTitle('LanguageFormatSettings');

    const [appSettings, setAppSettings] = useAppSettings();

    {
      const section = new SettingSection({
        name: 'LanguageFormat.TwoWayTranslation',
        caption: 'LanguageFormat.TwoWayCaption'
      });

      const enableRow = new Row({
        icon: 'language',
        titleLangKey: 'LanguageFormat.EnableTwoWay',
        checkboxField: new CheckboxField({
          name: 'enable-two-way-translation',
          stateKey: joinDeepPath('settings', 'languageFormat', 'enabled'),
          listenerSetter: this.listenerSetter,
          toggle: true
        }),
        listenerSetter: this.listenerSetter
      });

      const autoVoiceRow = new Row({
        icon: 'microphone',
        title: 'Auto-translate Voice Messages',
        checkboxField: new CheckboxField({
          name: 'auto-translate-voice',
          stateKey: joinDeepPath('settings', 'languageFormat', 'autoTranslateVoice'),
          listenerSetter: this.listenerSetter,
          toggle: true
        }),
        listenerSetter: this.listenerSetter
      });

      section.content.append(enableRow.container, autoVoiceRow.container);
      this.scrollable.append(section.container);
    }

    {
      const section = new SettingSection({
        name: 'LanguageFormat.Languages',
        caption: 'LanguageFormat.LanguagesCaption'
      });

      const findLabel = (list: LangOption[], code: string) =>
        list.find((o) => o.code === code)?.label ?? code;

      const myLanguageRow = new Row({
        icon: 'user',
        titleLangKey: 'LanguageFormat.YourLanguage',
        clickable: true,
        listenerSetter: this.listenerSetter,
        titleRightSecondary: true
      });

      const clientLanguageRow = new Row({
        icon: 'newprivate',
        titleLangKey: 'LanguageFormat.ClientLanguage',
        clickable: true,
        listenerSetter: this.listenerSetter,
        titleRightSecondary: true
      });

      const layoutStyleRow = new Row({
        icon: 'colorize',
        titleLangKey: 'LanguageFormat.LayoutStyle',
        clickable: true,
        listenerSetter: this.listenerSetter,
        titleRightSecondary: true
      });

      const refreshLabels = () => {
        myLanguageRow.titleRight.textContent = findLabel(MY_LANGUAGES, appSettings.languageFormat.myLanguage);
        clientLanguageRow.titleRight.textContent = findLabel(CLIENT_LANGUAGES, appSettings.languageFormat.clientLanguage);
        const ls = LAYOUT_STYLES.find((o) => o.value === appSettings.languageFormat.layoutStyle) ?? LAYOUT_STYLES[0];
        layoutStyleRow.titleRight.textContent = ls.label;
      };

      refreshLabels();

      createContextMenu({
        buttons: MY_LANGUAGES.map((opt) => ({
          icon: 'language',
          regularText: opt.label,
          onClick: () => {
            setAppSettings('languageFormat', 'myLanguage', opt.code);
            refreshLabels();
          }
        })),
        listenTo: myLanguageRow.container,
        middleware: this.middlewareHelper.get(),
        listenForClick: true
      });

      createContextMenu({
        buttons: CLIENT_LANGUAGES.map((opt) => ({
          icon: 'language',
          regularText: opt.label,
          onClick: () => {
            setAppSettings('languageFormat', 'clientLanguage', opt.code);
            refreshLabels();
          }
        })),
        listenTo: clientLanguageRow.container,
        middleware: this.middlewareHelper.get(),
        listenForClick: true
      });

      createContextMenu({
        buttons: LAYOUT_STYLES.map((opt) => ({
          icon: 'colorize',
          regularText: opt.label,
          onClick: () => {
            setAppSettings('languageFormat', 'layoutStyle', opt.value);
            refreshLabels();
          }
        })),
        listenTo: layoutStyleRow.container,
        middleware: this.middlewareHelper.get(),
        listenForClick: true
      });

      section.content.append(
        myLanguageRow.container,
        clientLanguageRow.container,
        layoutStyleRow.container
      );

      this.scrollable.append(section.container);
    }
  }
}
