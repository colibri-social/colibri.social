// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use cef::*;

const VK_TAB: i32 = 9;
const VK_PRIOR: i32 = 33;
const VK_NEXT: i32 = 34;
const VK_HOME: i32 = 36;
const VK_LEFT: i32 = 37;
const VK_RIGHT: i32 = 39;
const VK_DELETE: i32 = 46;
const VK_0: i32 = 48;
const VK_A: i32 = 65;
const VK_B: i32 = 66;
const VK_D: i32 = 68;
const VK_E: i32 = 69;
const VK_F: i32 = 70;
const VK_H: i32 = 72;
const VK_J: i32 = 74;
const VK_K: i32 = 75;
const VK_L: i32 = 76;
const VK_M: i32 = 77;
const VK_N: i32 = 78;
const VK_O: i32 = 79;
const VK_P: i32 = 80;
const VK_Q: i32 = 81;
const VK_R: i32 = 82;
const VK_S: i32 = 83;
const VK_T: i32 = 84;
const VK_U: i32 = 85;
const VK_W: i32 = 87;
const VK_NUMPAD0: i32 = 96;
const VK_ADD: i32 = 107;
const VK_SUBTRACT: i32 = 109;
const VK_F1: i32 = 112;
const VK_F3: i32 = 114;
const VK_F5: i32 = 116;
const VK_F6: i32 = 117;
const VK_F7: i32 = 118;
const VK_F10: i32 = 121;
const VK_F11: i32 = 122;
const VK_OEM_PLUS: i32 = 187;
const VK_OEM_MINUS: i32 = 189;

fn is_browser_shortcut(key_code: i32, primary_modifier: bool, shift: bool, alt: bool) -> bool {
  let primary = primary_modifier
    && matches!(
      key_code,
      VK_TAB
        | VK_PRIOR
        | VK_NEXT
        | VK_0..=57
        | VK_D
        | VK_E
        | VK_H
        | VK_J
        | VK_K
        | VK_L
        | VK_N
        | VK_O
        | VK_P
        | VK_R
        | VK_S
        | VK_T
        | VK_U
        | VK_W
        | VK_NUMPAD0
        | VK_ADD
        | VK_SUBTRACT
        | VK_OEM_PLUS
        | VK_OEM_MINUS
    );
  let primary_shift =
    primary_modifier && shift && matches!(key_code, VK_DELETE | VK_A | VK_B | VK_M | VK_Q);
  let alt_only = alt
    && !primary_modifier
    && matches!(key_code, VK_LEFT | VK_RIGHT | VK_HOME | VK_E | VK_F);
  let function_key = matches!(
    key_code,
    VK_F1 | VK_F3 | VK_F5 | VK_F6 | VK_F7 | VK_F10 | VK_F11
  );
  primary || primary_shift || alt_only || function_key
}

#[cfg(target_os = "linux")]
type CefOsEvent<'a> = Option<&'a mut cef::sys::XEvent>;
#[cfg(target_os = "macos")]
type CefOsEvent<'a> = *mut u8;
#[cfg(windows)]
type CefOsEvent<'a> = Option<&'a mut cef::sys::MSG>;

wrap_keyboard_handler! {
  pub struct TauriCefKeyboardHandler {
    devtools_enabled: bool,
  }

  impl KeyboardHandler {
    fn on_pre_key_event(
      &self,
      _browser: Option<&mut Browser>,
      event: Option<&KeyEvent>,
      _os_event: CefOsEvent<'_>,
      is_keyboard_shortcut: Option<&mut ::std::os::raw::c_int>,
    ) -> ::std::os::raw::c_int {
      let Some(event) = event else {
        return 0;
      };

      // Check if this is a keydown event.
      use cef::sys::cef_key_event_type_t;
      let keydown_type: cef::KeyEventType = cef_key_event_type_t::KEYEVENT_RAWKEYDOWN.into();
      if event.type_ != keydown_type {
        return 0;
      }

      // Get modifier keys.
      use cef::sys::cef_event_flags_t;
      #[cfg(windows)]
      let modifiers = event.modifiers as i32;
      #[cfg(not(windows))]
      let modifiers = event.modifiers;

      #[cfg(not(target_os = "macos"))]
      let primary_modifier = (modifiers & (cef_event_flags_t::EVENTFLAG_CONTROL_DOWN.0)) != 0;
      #[cfg(target_os = "macos")]
      let primary_modifier = (modifiers & (cef_event_flags_t::EVENTFLAG_COMMAND_DOWN.0)) != 0;
      let alt = (modifiers & (cef_event_flags_t::EVENTFLAG_ALT_DOWN.0)) != 0;
      let shift = (modifiers & (cef_event_flags_t::EVENTFLAG_SHIFT_DOWN.0)) != 0;

      let key_code = event.windows_key_code;

      if is_browser_shortcut(key_code, primary_modifier, shift, alt) {
        if let Some(is_keyboard_shortcut) = is_keyboard_shortcut {
          *is_keyboard_shortcut = 1;
        }
        return 0;
      }

      // If devtools is disabled, block devtools keyboard shortcuts.
      if !self.devtools_enabled {
        // Block F12 (key code 123).
        if key_code == 123 {
          if let Some(is_keyboard_shortcut) = is_keyboard_shortcut {
            *is_keyboard_shortcut = 1;
          }
          return 1;
        }

        // Block Ctrl+Shift+I on Linux/Windows and Cmd+Opt+I on macOS.
        #[cfg(not(target_os = "macos"))]
        let devtools_shortcut = key_code == 73 && primary_modifier && shift;
        #[cfg(target_os = "macos")]
        let devtools_shortcut = key_code == 73 && primary_modifier && alt;
        if devtools_shortcut {
          if let Some(is_keyboard_shortcut) = is_keyboard_shortcut {
            *is_keyboard_shortcut = 1;
          }
          return 1;
        }
      }

      0
    }

    fn on_key_event(
      &self,
      _browser: Option<&mut Browser>,
      event: Option<&KeyEvent>,
      _os_event: CefOsEvent<'_>,
    ) -> ::std::os::raw::c_int {
      let Some(event) = event else {
        return 0;
      };

      use cef::sys::{cef_event_flags_t, cef_key_event_type_t};
      let keydown_type: cef::KeyEventType = cef_key_event_type_t::KEYEVENT_RAWKEYDOWN.into();
      if event.type_ != keydown_type {
        return 0;
      }

      #[cfg(windows)]
      let modifiers = event.modifiers as i32;
      #[cfg(not(windows))]
      let modifiers = event.modifiers;

      #[cfg(not(target_os = "macos"))]
      let primary_modifier = (modifiers & (cef_event_flags_t::EVENTFLAG_CONTROL_DOWN.0)) != 0;
      #[cfg(target_os = "macos")]
      let primary_modifier = (modifiers & (cef_event_flags_t::EVENTFLAG_COMMAND_DOWN.0)) != 0;
      let alt = (modifiers & (cef_event_flags_t::EVENTFLAG_ALT_DOWN.0)) != 0;
      let shift = (modifiers & (cef_event_flags_t::EVENTFLAG_SHIFT_DOWN.0)) != 0;

      is_browser_shortcut(event.windows_key_code, primary_modifier, shift, alt)
        as ::std::os::raw::c_int
    }
  }
}

#[cfg(test)]
mod tests {
  use super::is_browser_shortcut;

  fn primary(key_code: i32) -> bool {
    is_browser_shortcut(key_code, true, false, false)
  }

  fn primary_shift(key_code: i32) -> bool {
    is_browser_shortcut(key_code, true, true, false)
  }

  fn alt(key_code: i32) -> bool {
    is_browser_shortcut(key_code, false, false, true)
  }

  fn bare(key_code: i32) -> bool {
    is_browser_shortcut(key_code, false, false, false)
  }

  #[test]
  fn blocks_chromium_browser_accelerators() {
    assert!(primary(84));
    assert!(primary(9));
    assert!(alt(37));
    assert!(bare(116));
  }

  #[test]
  fn blocks_function_keys() {
    for key_code in [112, 114, 116, 117, 118, 121, 122] {
      assert!(bare(key_code), "F key {key_code}");
    }
  }

  #[test]
  fn blocks_page_and_zoom_accelerators() {
    for key_code in [85, 68, 69, 75, 48, 96, 187, 189, 107, 109, 80, 83] {
      assert!(primary(key_code), "primary {key_code}");
    }
  }

  #[test]
  fn blocks_primary_shift_accelerators() {
    for key_code in [46, 81, 65, 77, 66] {
      assert!(primary_shift(key_code), "primary shift {key_code}");
    }
  }

  #[test]
  fn blocks_alt_accelerators() {
    for key_code in [36, 70, 69, 39] {
      assert!(alt(key_code), "alt {key_code}");
    }
  }

  #[test]
  fn allows_text_editing_shortcuts() {
    for key_code in [65, 67, 86, 88, 89, 90] {
      assert!(!primary(key_code), "primary {key_code}");
    }
    for key_code in [86, 90] {
      assert!(!primary_shift(key_code), "primary shift {key_code}");
    }
  }

  #[test]
  fn allows_webview_shortcuts() {
    assert!(!primary(66));
    assert!(!primary(70));
    assert!(!primary(73));
    assert!(!bare(13));
    assert!(!bare(27));
  }

  #[test]
  fn ignores_alt_letters_with_primary_modifier() {
    assert!(!is_browser_shortcut(70, true, false, true));
  }
}
