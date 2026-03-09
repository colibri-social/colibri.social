declare namespace App {
	// TODO(refactor): This should be extracted into a shared package that can be re-used across Colibri apps.
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

type ToastArgs =
	| string
	| {
			title?: string;
			description?: string;
			type?: ToastType;
			duration?: number;
			action?: {
				label: string;
				onClick: () => void;
			};
	  };

interface ToastFn {
	(args: ToastArgs): void;
	success(args: ToastArgs): void;
	error(args: ToastArgs): void;
	warning(args: ToastArgs): void;
	info(args: ToastArgs): void;
}

interface Window {
	toast: ToastFn;
}
