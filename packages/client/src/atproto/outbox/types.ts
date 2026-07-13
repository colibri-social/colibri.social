export type OutboxKind =
	| {
			t: "create";
			repo: string;
			collection: string;
			rkey: string;
			record: Record<string, unknown>;
	  }
	| {
			t: "put";
			repo: string;
			collection: string;
			rkey: string;
			record: Record<string, unknown>;
	  }
	| { t: "delete"; repo: string; collection: string; rkey: string }
	| {
			t: "appview";
			service: "appview" | "notif";
			lxm: string;
			route: string;
			method: string;
	  };

export type AppviewKind = Extract<OutboxKind, { t: "appview" }>;

export type OutboxRecord = {
	owner: string;
	kind: OutboxKind;
	label?: string;
	createdAt: number;
	attempts: number;
};

export type OutboxEntry = OutboxRecord & { seq: number };
