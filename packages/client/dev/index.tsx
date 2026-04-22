/* @refresh reload */
import 'solid-devtools';
import '../src/index.css';

import { render } from 'solid-js/web';

import App from '../src/app';
import { Router } from '@solidjs/router';
import { routes } from '../src/routes';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

render(
  () => <Router root={(props) => <App>{props.children}</App>}>{routes}</Router>,
  root,
);
