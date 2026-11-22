use std::ops::RangeInclusive;

use cef::*;

const IDC_CUT: i32 = 36000;
const IDC_COPY: i32 = 36001;
const IDC_PASTE: i32 = 36003;
const IDC_DEV_TOOLS: i32 = 40004;
const IDC_DEV_TOOLS_CONSOLE: i32 = 40005;
const IDC_DEV_TOOLS_DEVICES: i32 = 40007;
const IDC_DEV_TOOLS_INSPECT: i32 = 40023;
const IDC_DEV_TOOLS_TOGGLE: i32 = 40237;
const IDC_SPELLCHECK_SUGGESTIONS: RangeInclusive<i32> = 41000..=41005;
const IDC_SPELLCHECK_ADD_TO_DICTIONARY: i32 = 41110;
const IDC_SPELLCHECK_REMOVE_FROM_DICTIONARY: i32 = 41112;
const IDC_CONTENT_CONTEXT_EDITING: RangeInclusive<i32> = 50150..=50157;
const IDC_CONTENT_CONTEXT_INSPECTELEMENT: i32 = 50162;
const IDC_CONTENT_CONTEXT_SPELLING_SUGGESTION: i32 = 50167;
const IDC_CONTENT_CONTEXT_EMOJI: i32 = 50220;
const IDC_CONTENT_CONTEXT_NO_SPELLING_SUGGESTIONS: i32 = 57313;

const MENU_ID_EDITING: RangeInclusive<i32> = 110..=117;
const MENU_ID_SPELLING: RangeInclusive<i32> = 200..=206;

fn is_editing_command(command_id: i32) -> bool {
  matches!(command_id, IDC_CUT | IDC_COPY | IDC_PASTE)
    || IDC_CONTENT_CONTEXT_EDITING.contains(&command_id)
    || MENU_ID_EDITING.contains(&command_id)
}

fn is_spelling_command(command_id: i32) -> bool {
  IDC_SPELLCHECK_SUGGESTIONS.contains(&command_id)
    || MENU_ID_SPELLING.contains(&command_id)
    || matches!(
      command_id,
      IDC_SPELLCHECK_ADD_TO_DICTIONARY
        | IDC_SPELLCHECK_REMOVE_FROM_DICTIONARY
        | IDC_CONTENT_CONTEXT_SPELLING_SUGGESTION
        | IDC_CONTENT_CONTEXT_NO_SPELLING_SUGGESTIONS
    )
}

fn is_devtools_command(command_id: i32) -> bool {
  matches!(
    command_id,
    IDC_DEV_TOOLS
      | IDC_DEV_TOOLS_CONSOLE
      | IDC_DEV_TOOLS_DEVICES
      | IDC_DEV_TOOLS_INSPECT
      | IDC_DEV_TOOLS_TOGGLE
      | IDC_CONTENT_CONTEXT_INSPECTELEMENT
  )
}

pub(crate) fn is_app_command(command_id: i32, devtools_enabled: bool) -> bool {
  is_editing_command(command_id)
    || is_spelling_command(command_id)
    || command_id == IDC_CONTENT_CONTEXT_EMOJI
    || (devtools_enabled && is_devtools_command(command_id))
}

wrap_command_handler! {
  pub struct TauriCefCommandHandler {
    devtools_enabled: bool,
  }

  impl CommandHandler {
    fn on_chrome_command(
      &self,
      _browser: Option<&mut Browser>,
      command_id: ::std::os::raw::c_int,
      _disposition: WindowOpenDisposition,
    ) -> ::std::os::raw::c_int {
      (!is_app_command(command_id, self.devtools_enabled)) as ::std::os::raw::c_int
    }

    fn is_chrome_app_menu_item_visible(
      &self,
      _browser: Option<&mut Browser>,
      _command_id: ::std::os::raw::c_int,
    ) -> ::std::os::raw::c_int {
      0
    }

    fn is_chrome_page_action_icon_visible(
      &self,
      _icon_type: ChromePageActionIconType,
    ) -> ::std::os::raw::c_int {
      0
    }

    fn is_chrome_toolbar_button_visible(
      &self,
      _button_type: ChromeToolbarButtonType,
    ) -> ::std::os::raw::c_int {
      0
    }
  }
}

#[cfg(test)]
mod tests {
  use super::is_app_command;

  const BROWSER_COMMANDS: [i32; 14] = [
    33000, 33002, 34014, 34030, 35002, 35003, 35004, 35007, 37000, 37001, 38001, 38002, 38003,
    40012,
  ];

  #[test]
  fn swallows_browser_commands() {
    for command_id in BROWSER_COMMANDS {
      assert!(!is_app_command(command_id, false), "command {command_id}");
      assert!(!is_app_command(command_id, true), "command {command_id}");
    }
  }

  #[test]
  fn swallows_link_image_and_page_context_items() {
    for command_id in [50100, 50103, 50104, 50120, 50122, 50161, 50165, 50181, 50191, 51034] {
      assert!(!is_app_command(command_id, false), "command {command_id}");
    }
  }

  #[test]
  fn keeps_clipboard_and_editing_commands() {
    for command_id in [36000, 36001, 36003, 50150, 50151, 50152, 50153, 50154, 50155, 50156, 50157] {
      assert!(is_app_command(command_id, false), "command {command_id}");
    }
    for command_id in 110..=117 {
      assert!(is_app_command(command_id, false), "menu id {command_id}");
    }
  }

  #[test]
  fn keeps_spelling_and_emoji_commands() {
    for command_id in [41000, 41004, 41110, 41112, 50167, 50220, 57313, 200, 206] {
      assert!(is_app_command(command_id, false), "command {command_id}");
    }
  }

  #[test]
  fn keeps_devtools_commands_only_when_enabled() {
    for command_id in [40004, 40005, 40007, 40023, 40237, 50162] {
      assert!(!is_app_command(command_id, false), "command {command_id}");
      assert!(is_app_command(command_id, true), "command {command_id}");
    }
  }
}
