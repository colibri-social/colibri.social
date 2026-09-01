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
			t: "spaceCreate";
			space: string;
			repo: string;
			collection: string;
			rkey: string;
			record: Record<string, unknown>;
	  }
	| {
			t: "spacePut";
			space: string;
			repo: string;
			collection: string;
			rkey: string;
			record: Record<string, unknown>;
	  }
	| {
			t: "spaceDelete";
			space: string;
			repo: string;
			collection: string;
			rkey: string;
	  }
	| {
			t: "appview";
			service: "appview" | "notif";
			lxm: string;
			input: Record<string, unknown>;
	  };

export type AppviewKind = Extract<OutboxKind, { t: "appview" }>;

export type SpaceKind = Extract<
	OutboxKind,
	{ t: "spaceCreate" | "spacePut" | "spaceDelete" }
>;

export const isSpaceKind = (kind: OutboxKind): kind is SpaceKind =>
	kind.t === "spaceCreate" || kind.t === "spacePut" || kind.t === "spaceDelete";

export type OutboxRecord = {
	owner: string;
	kind: OutboxKind;
	label?: string;
	group?: string;
	createdAt: number;
	attempts: number;
};

export type OutboxEntry = OutboxRecord & { seq: number };
