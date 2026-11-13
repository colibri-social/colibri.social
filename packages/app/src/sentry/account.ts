import { createSignal } from "solid-js";

type ReportingAccount = { did: string | undefined; optedIn: boolean };

const [account, setAccount] = createSignal<ReportingAccount>({
	did: undefined,
	optedIn: false,
});

export const reportingAccount = account;
export const setReportingAccount = setAccount;
