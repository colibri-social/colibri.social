import { createSignal } from "solid-js";

export type ReportingAccount = { did: string | undefined; optedIn: boolean };

const [account, setAccount] = createSignal<ReportingAccount>({
	did: undefined,
	optedIn: false,
});

export const reportingAccount = account;
export const setReportingAccount = setAccount;
