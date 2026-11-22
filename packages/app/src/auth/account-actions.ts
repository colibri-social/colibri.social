import { createContext, useContext } from "solid-js";

export type AccountActions = { signOut: () => Promise<void> };

export const AccountActionsContext = createContext<AccountActions>();

export const useAccountActions = () => useContext(AccountActionsContext);
