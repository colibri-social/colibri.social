interface ReportingAccount {
	did: string | undefined;
	optedIn: boolean;
}

let current: ReportingAccount = { did: undefined, optedIn: false };

export const setReportingAccount = (next: ReportingAccount): void => {
	current = next;
};

export const reportingAccount = (): ReportingAccount => current;
