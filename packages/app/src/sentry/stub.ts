type StubScope = {
	setTag: (key: string, value: unknown) => StubScope;
	setUser: (user: { id: string } | null) => StubScope;
	setContext: (key: string, context: unknown) => StubScope;
	setFingerprint: (fingerprint: Array<string>) => StubScope;
	setLevel: (level: unknown) => StubScope;
};

const stubScope: StubScope = {
	setTag: () => stubScope,
	setUser: () => stubScope,
	setContext: () => stubScope,
	setFingerprint: () => stubScope,
	setLevel: () => stubScope,
};

export function init(): void {}

export function browserTracingIntegration(): Record<string, never> {
	return {};
}

export function addBreadcrumb(_breadcrumb: unknown): void {}

export function setUser(_user: { id: string } | null): void {}

export function captureException(_error: unknown): string {
	return "";
}

export function captureFeedback(_feedback: unknown): string {
	return "";
}

export function withScope<T>(callback: (scope: StubScope) => T): T {
	return callback(stubScope);
}

export function getClient(): undefined {
	return undefined;
}
