declare namespace App {
	// TODO: This should be extracted into a shared package that can be re-used across colibri apps.
	interface SessionData {
		user: {
			// Provided by `social.colibri.actor.data`
			status: string;
			communities: Array<string>,
			// Provided by `app.bsky.actor.profile`
			avatar: string;
			banner: string;
			description: string;
			displayName: string;
			// This is the user's first A.K.A. (I think?)
			identity: string;
		}
	}
}
