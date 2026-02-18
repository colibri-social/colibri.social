export type MaybeResponse<T> =
	| {
			error: null;
			data: T;
	  }
	| {
			error: string;
			data: null;
	  };
