// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use cef::*;

use super::command::is_app_command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MenuEntry {
  Separator,
  Command(i32),
  Submenu,
}

fn retained_entries(entries: &[MenuEntry], devtools_enabled: bool) -> Vec<bool> {
  let mut keep: Vec<bool> = entries
    .iter()
    .map(|entry| match entry {
      MenuEntry::Command(command_id) => is_app_command(*command_id, devtools_enabled),
      MenuEntry::Separator | MenuEntry::Submenu => false,
    })
    .collect();

  let mut previous_kept_command = false;
  let mut pending_separator = None;
  for (index, entry) in entries.iter().enumerate() {
    match entry {
      MenuEntry::Separator if previous_kept_command => {
        pending_separator.get_or_insert(index);
      }
      MenuEntry::Command(_) if keep[index] => {
        if let Some(separator) = pending_separator.take() {
          keep[separator] = true;
        }
        previous_kept_command = true;
      }
      _ => {}
    }
  }

  keep
}

fn menu_entries(model: &MenuModel) -> Vec<MenuEntry> {
  (0..model.count())
    .map(|index| {
      let item_type = model.type_at(index);
      if item_type == MenuItemType::SEPARATOR {
        MenuEntry::Separator
      } else if item_type == MenuItemType::SUBMENU {
        MenuEntry::Submenu
      } else {
        MenuEntry::Command(model.command_id_at(index))
      }
    })
    .collect()
}

wrap_context_menu_handler! {
  pub struct TauriCefContextMenuHandler {
    devtools_enabled: bool,
  }

  impl ContextMenuHandler {
    fn on_before_context_menu(
      &self,
      _browser: Option<&mut Browser>,
      _frame: Option<&mut Frame>,
      _params: Option<&mut ContextMenuParams>,
      model: Option<&mut MenuModel>,
    ) {
      let Some(model) = model else {
        return;
      };
      let keep = retained_entries(&menu_entries(model), self.devtools_enabled);
      for (index, kept) in keep.iter().enumerate().rev() {
        if !kept {
          model.remove_at(index);
        }
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::{MenuEntry, retained_entries};

  const UNDO: MenuEntry = MenuEntry::Command(50154);
  const REDO: MenuEntry = MenuEntry::Command(50155);
  const CUT: MenuEntry = MenuEntry::Command(50151);
  const COPY: MenuEntry = MenuEntry::Command(50150);
  const PASTE: MenuEntry = MenuEntry::Command(50152);
  const SELECT_ALL: MenuEntry = MenuEntry::Command(50156);
  const PRINT: MenuEntry = MenuEntry::Command(35003);
  const VIEW_SOURCE: MenuEntry = MenuEntry::Command(35002);
  const INSPECT: MenuEntry = MenuEntry::Command(50162);
  const SEARCH_WEB: MenuEntry = MenuEntry::Command(50191);
  const SEPARATOR: MenuEntry = MenuEntry::Separator;
  const SUBMENU: MenuEntry = MenuEntry::Submenu;

  fn kept(entries: &[MenuEntry], devtools_enabled: bool) -> Vec<MenuEntry> {
    entries
      .iter()
      .zip(retained_entries(entries, devtools_enabled))
      .filter_map(|(entry, keep)| keep.then_some(*entry))
      .collect()
  }

  #[test]
  fn keeps_only_editing_items_in_an_editable_field() {
    let entries = [
      UNDO, REDO, SEPARATOR, CUT, COPY, PASTE, SELECT_ALL, SEPARATOR, SEARCH_WEB, SUBMENU,
      SEPARATOR, PRINT, VIEW_SOURCE, SEPARATOR, INSPECT,
    ];
    assert_eq!(
      kept(&entries, false),
      vec![UNDO, REDO, SEPARATOR, CUT, COPY, PASTE, SELECT_ALL]
    );
  }

  #[test]
  fn keeps_inspect_when_devtools_are_enabled() {
    let entries = [COPY, SEPARATOR, PRINT, SEPARATOR, INSPECT];
    assert_eq!(kept(&entries, true), vec![COPY, SEPARATOR, INSPECT]);
  }

  #[test]
  fn drops_every_browser_item_and_separator_on_page_menus() {
    let entries = [
      MenuEntry::Command(33000),
      MenuEntry::Command(33002),
      SEPARATOR,
      PRINT,
      VIEW_SOURCE,
      SEPARATOR,
      INSPECT,
    ];
    assert!(kept(&entries, false).is_empty());
  }

  #[test]
  fn collapses_repeated_separators() {
    let entries = [SEPARATOR, COPY, SEPARATOR, PRINT, SEPARATOR, PASTE, SEPARATOR];
    assert_eq!(kept(&entries, false), vec![COPY, SEPARATOR, PASTE]);
  }
}
