declare namespace App {
	// TODO: This should be extracted into a shared package that can be re-used across colibri apps.
	interface SessionData {
		user: {
			// Provided by `social.colibri.actor.data`
			status: string;
			communities: Array<string>;
			// Provided by `app.bsky.actor.profile`
			avatar: string | undefined;
			banner: string | undefined;
			description: string | undefined;
			displayName: string | undefined;
			// This is the user's handle
			identity: string;
			sub: string;
		};
	}
}
